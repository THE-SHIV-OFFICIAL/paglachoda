/**
 * Built-in Telegram streamer. Streams movie files saved in MongoDB (Telegram
 * file_id + file_ref) straight from Telegram's servers, with byte-range
 * support so the player can seek. No external stream bot needed.
 *
 * Needs: TELEGRAM_API_ID, TELEGRAM_API_HASH (my.telegram.org) and
 * TELEGRAM_BOT_TOKEN of the SAME bot that saved the files into MongoDB
 * (Telegram file ids only work for the bot that received them).
 */
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import bigInt from "big-integer";

type Decoded = { type: number; dc: number; id: bigInt.BigInteger; accessHash: bigInt.BigInteger };

function b64(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4), "base64");
}

function rleDecode(b: Buffer): Buffer {
  const out: number[] = [];
  for (let i = 0; i < b.length; i++) {
    if (b[i] === 0 && i + 1 < b.length) { for (let k = 0; k < b[i + 1]; k++) out.push(0); i++; }
    else out.push(b[i]);
  }
  return Buffer.from(out);
}

/** Decodes Pyrogram/bot-api style file ids (both short "unpacked" and full). */
export function decodeFileId(fileId: string): Decoded | null {
  try {
    const d = rleDecode(b64(fileId));
    let type = d.readInt32LE(0);
    const dc = d.readInt32LE(4);
    let off = 8;
    if (type & (1 << 25)) type &= ~(1 << 25); // web location flag (unused here)
    if (type & (1 << 24)) {
      type &= ~(1 << 24);
      // embedded file_reference (TL bytes)
      let len = d[off];
      let hdr = 1;
      if (len === 254) { len = d[off + 1] | (d[off + 2] << 8) | (d[off + 3] << 16); hdr = 4; }
      off += hdr + len;
      off += (4 - ((hdr + len) % 4)) % 4;
    }
    const id = bigInt(d.readBigInt64LE(off).toString());
    const accessHash = bigInt(d.readBigInt64LE(off + 8).toString());
    return { type, dc, id, accessHash };
  } catch {
    return null;
  }
}

const g = globalThis as unknown as { __tg?: Promise<TelegramClient> };

const TG_API_ID = Number(process.env.TELEGRAM_API_ID || 2040);
const TG_API_HASH = process.env.TELEGRAM_API_HASH || "b18441a1ff607e10a989891a5462e627";

export function tgConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

async function client(): Promise<TelegramClient> {
  if (!g.__tg) {
    g.__tg = (async () => {
      const c = new TelegramClient(new StringSession(process.env.TELEGRAM_SESSION ?? ""), TG_API_ID, TG_API_HASH, {
        connectionRetries: 5,
        autoReconnect: true,
      });
      c.setLogLevel("error" as never);
      await c.start({ botAuthToken: process.env.TELEGRAM_BOT_TOKEN! });
      return c;
    })().catch((e) => { g.__tg = undefined; throw e; });
  }
  return g.__tg;
}

const CHUNK = 1024 * 1024; // Telegram allows up to 1 MB per request, offset must be aligned

export async function streamTelegram(opts: {
  fileId: string;
  fileRef?: string | null;
  size: number;
  mime?: string | null;
  range?: string | null;
  download?: string | null;
}): Promise<Response> {
  const dec = decodeFileId(opts.fileId);
  if (!dec) return Response.json({ error: "Bad file id." }, { status: 400 });
  const c = await client();
  const mkLoc = (ref: Buffer) => new Api.InputDocumentFileLocation({
    id: dec.id,
    accessHash: dec.accessHash,
    fileReference: ref,
    thumbSize: "",
  });
  let refFallback = !opts.fileRef;
  let location = mkLoc(opts.fileRef ? b64(opts.fileRef) : Buffer.alloc(0));

  const size = opts.size;
  let start = 0;
  let end = size - 1;
  const m = opts.range?.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    if (m[1]) start = Number(m[1]);
    if (m[2]) end = Math.min(Number(m[2]), size - 1);
    if (!m[1] && m[2]) { start = size - Number(m[2]); end = size - 1; }
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }

  const alignedStart = start - (start % CHUNK);
  const wanted = end - start + 1;
  let skip = start - alignedStart;
  let remaining = wanted;

  let pos = alignedStart;
  const mkIter = () => c.iterDownload({
    file: location,
    offset: bigInt(pos),
    requestSize: CHUNK,
    chunkSize: CHUNK,
    dcId: dec.dc,
    fileSize: bigInt(size),
  })[Symbol.asyncIterator]();
  let iter = mkIter();
  const isExpired = (e: any) => /FILE_REFERENCE_(EXPIRED|INVALID|EMPTY)/.test(String(e?.errorMessage || e?.message || e));
  const nextChunk = async () => {
    try { return await iter.next(); }
    catch (e) {
      if (refFallback || !isExpired(e)) throw e;
      // stale file_ref from DB -> retry same offset with empty reference
      refFallback = true;
      try { await iter.return?.(undefined); } catch {}
      location = mkLoc(Buffer.alloc(0));
      iter = mkIter();
      return await iter.next();
    }
  };

  let finished = false;
  const stop = async () => {
    if (finished) return;
    finished = true;
    try { await iter.return?.(undefined); } catch {}
  };
  const body = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      if (finished) return;
      const close = () => { if (!finished) { finished = true; try { ctrl.close(); } catch {} } void iter.return?.(undefined)?.catch?.(() => {}); };
      try {
        if (remaining <= 0) return close();
        const { value, done } = await nextChunk();
        if (finished) return; // viewer left while we were waiting
        if (done || !value) return close();
        let buf = value as Buffer;
        pos += buf.length;
        if (skip) { buf = buf.subarray(skip); skip = 0; }
        if (buf.length > remaining) buf = buf.subarray(0, remaining);
        remaining -= buf.length;
        try { ctrl.enqueue(new Uint8Array(buf)); } catch { return stop(); }
        if (remaining <= 0) close();
      } catch (e) {
        if (finished) return;
        finished = true;
        try { ctrl.error(e); } catch {}
      }
    },
    async cancel() { await stop(); },
  });

  const headers = new Headers({
    "Content-Type": opts.mime || "video/mp4",
    "Accept-Ranges": "bytes",
    "Content-Length": String(wanted),
    "Cache-Control": "no-store",
  });
  if (opts.download) headers.set("Content-Disposition", `attachment; filename="${opts.download.replace(/"/g, "")}"`);
  const partial = Boolean(opts.range);
  if (partial) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  return new Response(body, { status: partial ? 206 : 200, headers });
}
