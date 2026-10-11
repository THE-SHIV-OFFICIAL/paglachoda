import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Movie library. Works with ANY MongoDB layout and with several clusters:
 *  - MONGODB_URI, MONGODB_URI_2, MONGODB_URI_3 ... (or MONGODB_URIS=uri1,uri2)
 *  - Every database is searched; the movie collection is found automatically
 *    (or set MONGODB_DB / MONGODB_COLLECTION).
 *  - Title from title / name / file_name / caption ...
 *  - Video from a direct link (url / link / stream_url ...) OR a Telegram file
 *    (file_id, or _id in Auto-Filter / Media-Search bot indexes).
 */
export interface LibraryEntry {
  id: string;
  title: string;
  type: "movie" | "tv";
  season?: number | null;
  episode?: number | null;
  quality: string;
  url: string; // direct link, or "tg:<file_id>" for Telegram files
  size?: number | null;
  fileName?: string | null;
  fileRef?: string | null;
  mime?: string | null;
  createdAt: number;
}

type Doc = Record<string, unknown>;
type Col = import("mongodb").Collection<Doc>;

const FILE = path.join(process.env.LIBRARY_FILE ?? "/tmp", "moviebox-library.json");

export const TITLE_FIELDS = ["title", "name", "movie_name", "movieName", "file_name", "fileName", "filename", "caption"];
export const URL_FIELDS = ["url", "link", "stream_url", "streamUrl", "stream_link", "file_url", "fileUrl", "download_url", "downloadUrl", "direct_link", "directLink", "video_url", "videoUrl", "video", "src", "mp4", "m3u8"];
export const TG_FIELDS = ["file_id", "fileId", "telegram_file_id", "tg_file_id"];

function mongoUris(): string[] {
  const list: string[] = [];
  if (process.env.MONGODB_URIS) list.push(...process.env.MONGODB_URIS.split(/[,\s]+/));
  if (process.env.MONGODB_URI) list.push(process.env.MONGODB_URI);
  for (let i = 2; i <= 9; i++) {
    const v = process.env[`MONGODB_URI_${i}`];
    if (v) list.push(v);
  }
  return Array.from(new Set(list.map((s) => s.trim()).filter(Boolean)));
}

async function client(uri: string) {
  const { MongoClient } = await import("mongodb");
  const g = globalThis as unknown as { __mbClients?: Map<string, Promise<InstanceType<typeof MongoClient>>> };
  g.__mbClients ??= new Map();
  let p = g.__mbClients.get(uri);
  if (!p) {
    p = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 }).connect().catch((e) => {
      g.__mbClients!.delete(uri); // retry next time instead of caching the failure
      throw e;
    });
    g.__mbClients.set(uri, p);
  }
  return p;
}

const pick = (d: Doc, keys: string[]) => {
  for (const k of keys) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

/** Telegram file-bot indexes keep the file_id in _id. */
function tgId(d: Doc) {
  const v = pick(d, TG_FIELDS);
  if (v) return v;
  if (typeof d._id === "string" && (d.file_ref || d.file_type || d.mime_type || d.file_size)) return d._id;
  return null;
}

function isVideo(d: Doc) {
  const mime = String(d.mime_type ?? d.mimeType ?? "");
  const ft = String(d.file_type ?? "");
  if (mime) return mime.startsWith("video/");
  if (ft === "audio" || ft === "photo") return false;
  return true;
}

function looksLikeMovie(d: Doc) {
  return !!pick(d, TITLE_FIELDS) && (!!pick(d, URL_FIELDS) || !!tgId(d)) && isVideo(d);
}

const SKIP = new Set(["users", "user", "uersz", "otps", "sessions", "settings", "activity", "keys", "groups", "misc", "comments", "theaters"]);

/** One movie collection per cluster, auto-detected and cached. */
async function mongoCollections(): Promise<Col[]> {
  const uris = mongoUris();
  if (!uris.length) return [];
  const g = globalThis as unknown as { __mbLibs?: Map<string, { db: string; col: string } | null> };
  g.__mbLibs ??= new Map();
  const out: Col[] = [];
  for (const uri of uris) {
    try {
      const c = await client(uri);
      if (!g.__mbLibs.has(uri)) {
        const forcedDb = process.env.MONGODB_DB;
        const forcedCol = process.env.MONGODB_COLLECTION;
        const dbNames = forcedDb
          ? [forcedDb]
          : (await c.db().admin().listDatabases({ nameOnly: true })).databases.map((d) => d.name).filter((n) => !["admin", "local", "config"].includes(n));
        let best: { db: string; col: string; count: number } | null = null;
        for (const dbName of dbNames) {
          const db = c.db(dbName);
          const names = forcedCol ? [forcedCol] : (await db.listCollections({}, { nameOnly: true }).toArray()).map((x) => x.name);
          for (const name of names) {
            if (!forcedCol && (SKIP.has(name) || name.startsWith("system."))) continue;
            const sample = await db.collection(name).find({}).limit(8).toArray();
            if (!sample.some((d) => looksLikeMovie(d as Doc))) continue;
            const count = await db.collection(name).estimatedDocumentCount();
            if (!best || count > best.count) best = { db: dbName, col: name, count };
          }
        }
        g.__mbLibs.set(uri, best ? { db: best.db, col: best.col } : null);
      }
      const where = g.__mbLibs.get(uri);
      if (where) out.push(c.db(where.db).collection<Doc>(where.col));
    } catch (e) {
      console.error("[library] MongoDB unreachable:", (e as Error).message);
    }
  }
  return out;
}

/** Collection used for admin-added entries (first cluster). */
async function writableCollection(): Promise<Col | null> {
  const uris = mongoUris();
  if (!uris.length) return null;
  const cols = await mongoCollections();
  if (cols[0]) return cols[0];
  const c = await client(uris[0]);
  return c.db(process.env.MONGODB_DB || "moviebox").collection<Doc>(process.env.MONGODB_COLLECTION || "library");
}

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Converts any stored document into a LibraryEntry (null if it has no video). */
export function normalizeDoc(d: Doc): LibraryEntry | null {
  if (!isVideo(d)) return null;
  const title = pick(d, TITLE_FIELDS);
  const link = pick(d, URL_FIELDS);
  const tg = tgId(d);
  if (!title || (!link && !tg)) return null;
  const fileName = pick(d, ["file_name", "fileName", "filename"]) ?? null;
  const text = `${title} ${fileName ?? ""}`;
  const se = text.match(/\bS(\d{1,2})\s*[ .\-_]?\s*E(\d{1,3})\b/i);
  const rawType = String(d.type ?? d.media_type ?? "").toLowerCase();
  const season = toNumber(d.season) ?? (se ? Number(se[1]) : null);
  const episode = toNumber(d.episode) ?? (se ? Number(se[2]) : null);
  const type: "movie" | "tv" = rawType === "tv" || rawType === "series" || season || /\bS\d{1,2}\b/i.test(text) ? "tv" : "movie";
  const id = typeof d.id === "string" && d.id ? d.id : String(d._id ?? tg ?? randomUUID());
  return {
    id,
    title,
    type,
    season,
    episode,
    quality: detectQuality(text, typeof d.quality === "string" ? d.quality : null),
    url: link && /^https?:\/\//i.test(link) ? link : `tg:${tg ?? link}`,
    size: toNumber(d.size ?? d.file_size ?? d.fileSize),
    fileName,
    fileRef: typeof d.file_ref === "string" ? d.file_ref : null,
    mime: typeof d.mime_type === "string" ? d.mime_type : null,
    createdAt: toNumber(d.createdAt ?? d.created_at ?? d.date) ?? 0,
  };
}

async function readFile(): Promise<LibraryEntry[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

export async function listLibrary(): Promise<LibraryEntry[]> {
  const cols = await mongoCollections();
  if (cols.length) {
    const all: LibraryEntry[] = [];
    for (const col of cols) {
      const docs = await col.find({}).sort({ $natural: -1 }).limit(250).toArray();
      all.push(...(docs.map((d) => normalizeDoc(d)).filter(Boolean) as LibraryEntry[]));
    }
    return all;
  }
  return (await readFile()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function addEntry(input: Omit<LibraryEntry, "id" | "createdAt">): Promise<LibraryEntry> {
  const entry: LibraryEntry = { ...input, id: randomUUID(), createdAt: Date.now() };
  const col = await writableCollection();
  if (col) await col.insertOne({ ...entry });
  else await fs.writeFile(FILE, JSON.stringify([entry, ...(await readFile())]));
  return entry;
}

async function idFilter(id: string) {
  const or: Doc[] = [{ id }, ...TG_FIELDS.map((f) => ({ [f]: id })), { _id: id }];
  if (/^[a-f0-9]{24}$/i.test(id)) {
    const { ObjectId } = await import("mongodb");
    or.push({ _id: new ObjectId(id) });
  }
  return { $or: or };
}

export async function removeEntry(id: string) {
  const cols = await mongoCollections();
  if (cols.length) {
    const f = await idFilter(id);
    for (const col of cols) await col.deleteOne(f);
  } else await fs.writeFile(FILE, JSON.stringify((await readFile()).filter((e) => e.id !== id)));
}

export async function getEntry(id: string): Promise<LibraryEntry | null> {
  const cols = await mongoCollections();
  if (cols.length) {
    const f = await idFilter(id);
    for (const col of cols) {
      const d = await col.findOne(f);
      if (d) return normalizeDoc(d);
    }
    return null;
  }
  return (await readFile()).find((e) => e.id === id) ?? null;
}

/** Diagnostic: what the databases look like (field names only, no values). */
export async function inspectLibrary() {
  const uris = mongoUris();
  if (!uris.length) return { connected: false, reason: "MONGODB_URI is not set" };
  const cols = await mongoCollections();
  const libraries = [];
  for (const col of cols) {
    const sample = (await col.find({}).sort({ $natural: -1 }).limit(5).toArray()) as Doc[];
    libraries.push({
      database: col.dbName,
      collection: col.collectionName,
      count: await col.estimatedDocumentCount(),
      fields: Array.from(new Set(sample.flatMap((d) => Object.keys(d)))),
      latest: sample.map((d) => {
        const e = normalizeDoc(d);
        return e ? { title: e.title, quality: e.quality, language: detectLanguage(e.title), source: e.url.startsWith("tg:") ? "telegram file_id" : "direct link" } : null;
      }),
    });
  }
  return { connected: cols.length > 0, clusters: uris.length, libraries };
}

const norm = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/[._]+/g, " ").replace(/[^a-z0-9\u0900-\u097f]+/g, " ").trim();

const QUALITY_RANK: Record<string, number> = { "2160p": 4, "1080p": 3, "720p": 2, "480p": 1 };

export interface PlayableSource {
  id: string;
  quality: string;
  language: string;
  label: string;
  size?: number | null;
  fileName?: string | null;
}

const LANGS: Array<[RegExp, string]> = [
  [/\bhin(di)?\b/i, "Hindi"],
  [/\beng(lish)?\b/i, "English"],
  [/\btam(il)?\b/i, "Tamil"],
  [/\btel(ugu)?\b/i, "Telugu"],
  [/\bmal(ayalam)?\b/i, "Malayalam"],
  [/\bkan(nada)?\b/i, "Kannada"],
  [/\bkor(ean)?\b/i, "Korean"],
  [/\bjap(anese)?\b/i, "Japanese"],
];

export function detectLanguage(text: string): string {
  const t = text.replace(/[._\[\]()]+/g, " ");
  const found = LANGS.filter(([re]) => re.test(t)).map(([, n]) => n);
  if (/\bmulti\s*audio\b/i.test(t) || found.length > 2) return "Multi Audio";
  if (/\bdual(\s*audio)?\b/i.test(t) || found.length === 2) return "Dual Audio";
  return found[0] ?? "Original";
}

export function detectQuality(text: string, fallback?: string | null): string {
  const m = text.match(/(2160|1080|720|480|360)p/i);
  if (m) return `${m[1]}p`;
  if (/\b4k\b/i.test(text)) return "2160p";
  return fallback || "Auto";
}

/** HEVC/x265/10-bit files don't play in most browsers — prefer x264 when both exist. */
const browserPenalty = (t: string) => (/\b(hevc|x265|h\s*265|10\s*bit|10b)\b/i.test(t) ? 1 : 0);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Candidates via a DB query on every title-like field — never loads the whole library. */
async function candidates(title: string): Promise<LibraryEntry[]> {
  const q = norm(title);
  if (!q) return [];
  const cols = await mongoCollections();
  if (cols.length) {
    const words = q.split(" ").filter((w) => w.length > 1 && w !== "and" && w !== "the").slice(0, 6);
    const pattern = (words.length ? words : q.split(" ")).map(escapeRe).join("[\\s\\S]*");
    const filter = { $or: TITLE_FIELDS.map((f) => ({ [f]: { $regex: pattern, $options: "i" } })) };
    const results = await Promise.all(cols.map((col) => col.find(filter).limit(300).toArray().catch(() => [])));
    return results.flat().map((d) => normalizeDoc(d)).filter(Boolean) as LibraryEntry[];
  }
  return readFile();
}

function score(e: LibraryEntry, q: string, opts: { type?: string | null; season?: number; episode?: number }) {
  const t = norm(e.title);
  let s = 0;
  if (t === q) s = 100;
  else if (t.startsWith(q + " ") || t.includes(" " + q + " ")) s = 70;
  else if (t.includes(q) || q.includes(t)) s = 60;
  else {
    const qw = q.split(" ").filter((w) => w.length > 2 && w !== "and" && w !== "the");
    const hit = qw.filter((w) => t.includes(w)).length;
    if (qw.length && hit === qw.length) s = 40;
  }
  if (!s) return 0;
  if (opts.type && e.type !== opts.type) s -= 30;
  if (opts.season && e.season && e.season !== opts.season) s -= 30;
  if (opts.episode && e.episode && e.episode !== opts.episode) s -= 30;
  return s;
}

/** All playable files for a title, grouped by quality + language. */
export async function findSources(
  title: string,
  opts: { type?: string | null; season?: number; episode?: number } = {},
): Promise<PlayableSource[]> {
  const q = norm(title);
  if (!q) return [];
  const list = (await candidates(title))
    .map((e) => ({ e, s: score(e, q, opts) }))
    .filter((x) => x.s > 0);
  if (!list.length) return [];
  const best = Math.max(...list.map((x) => x.s));
  const seen = new Set<string>();
  const out: PlayableSource[] = [];
  const top = list
    .filter((x) => x.s === best)
    .sort((a, b) => browserPenalty(`${a.e.title} ${a.e.fileName ?? ""}`) - browserPenalty(`${b.e.title} ${b.e.fileName ?? ""}`));
  for (const { e } of top) {
    const text = `${e.title} ${e.fileName ?? ""}`;
    const quality = detectQuality(text, e.quality);
    const language = detectLanguage(text);
    const key = `${quality}|${language}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: e.id, quality, language, label: `${quality} · ${language}`, size: e.size ?? null, fileName: e.fileName ?? null });
  }
  const rank = (q: string) => parseInt(q, 10) || 0;
  const langRank = (l: string) => (l === "Hindi" ? 0 : l === "Dual Audio" ? 1 : l === "Multi Audio" ? 2 : 3);
  return out.sort((a, b) => langRank(a.language) - langRank(b.language) || rank(b.quality) - rank(a.quality));
}

/** Best entry for a title (and season/episode for series). */
export async function findEntry(
  title: string,
  opts: { type?: string | null; season?: number; episode?: number } = {},
): Promise<LibraryEntry | null> {
  const q = norm(title);
  if (!q) return null;
  const scored = (await candidates(title))
    .map((e) => ({ e, score: score(e, q, opts) * 10 + (QUALITY_RANK[e.quality] ?? 0) - browserPenalty(`${e.title} ${e.fileName ?? ""}`) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.e ?? null;
}
