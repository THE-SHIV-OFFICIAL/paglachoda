"use client";

/**
 * Download library — keeps track of everything the user has downloaded
 * (or is currently downloading) in localStorage, and performs the actual
 * file download with live progress.
 */

const LS_PREFIX = process.env.NEXT_PUBLIC_LS_PREFIX ?? "fw_";
const DOWNLOADS_KEY = `${LS_PREFIX}downloads`;
const MAX_ITEMS = 100;

export type DownloadStatus = "queued" | "downloading" | "completed" | "failed" | "opened" | "device";

export interface DownloadItem {
    id: string;              // unique key: `${type}-${tmdbId}-${quality}`
    tmdbId: string;
    type: "movie" | "tv";
    title: string;
    poster_path?: string | null;
    quality: string;
    season?: number;
    episode?: number;
    url: string;
    fileName: string;
    size?: number | null;     // total bytes, when known
    received?: number;        // bytes received so far
    status: DownloadStatus;
    /** true when the file is stored inside the app for offline playback */
    offline?: boolean;
    /** true when Android saved it to the phone (Download/MovieBox) */
    device?: boolean;
    error?: string | null;

    createdAt: number;
    updatedAt: number;
}

export const DOWNLOADS_EVENT = "downloadsUpdated";

function emit() {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(DOWNLOADS_EVENT));
}

export function getDownloads(): DownloadItem[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(DOWNLOADS_KEY);
        const list = raw ? (JSON.parse(raw) as DownloadItem[]) : [];
        return Array.isArray(list) ? list.sort((a, b) => b.updatedAt - a.updatedAt) : [];
    } catch {
        return [];
    }
}

function writeAll(list: DownloadItem[]) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
    } catch {
        /* quota — ignore */
    }
    emit();
}

export function upsertDownload(item: DownloadItem) {
    const list = getDownloads().filter((d) => d.id !== item.id);
    list.unshift(item);
    writeAll(list);
}

export function patchDownload(id: string, patch: Partial<DownloadItem>) {
    const list = getDownloads();
    const idx = list.findIndex((d) => d.id === id);
    if (idx === -1) return;
    list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() };
    writeAll(list);
}

export function removeDownload(id: string) {
    writeAll(getDownloads().filter((d) => d.id !== id));
}

export function clearDownloads() {
    writeAll([]);
}

export function formatBytes(bytes?: number | null): string {
    if (!bytes || bytes <= 0) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
        value /= 1024;
        i++;
    }
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function safeFileName(title: string, quality: string, ext = "mp4"): string {
    const clean = title
        .replace(/[\\/:*?"<>|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
    return `${clean || "video"} [${quality}].${ext}`;
}

/** Absolute URL for a stream/download path returned by the API. */
export function toAbsolute(url: string): string {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    if (typeof window === "undefined") return url;
    return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Add ?dl=1&name=… so the server answers with an attachment header. */
export function withDownloadFlag(url: string, fileName: string): string {
    const abs = toAbsolute(url);
    try {
        const u = new URL(abs);
        u.searchParams.set("dl", "1");
        u.searchParams.set("name", fileName);
        return u.toString();
    } catch {
        return abs;
    }
}

function triggerBrowserDownload(href: string, fileName: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Start a download. Tries a streamed fetch so we can show real progress and
 * keep a copy in the offline vault; if that is blocked (CORS / low memory) it
 * falls back to a plain browser download so the user never ends up with
 * nothing.
 */
export const DOWNLOAD_POPUP_EVENT = "downloadPopup";

/** Show the floating download popup for an item. */
function announce(item: DownloadItem) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(DOWNLOAD_POPUP_EVENT, { detail: { id: item.id } }));
}

/**
 * Start a download.
 *
 * 1. Inside the Android app the file goes straight to Android's DownloadManager,
 *    so it is saved in the phone's own storage (Download/MovieBox) with a
 *    notification, and any player (MX Player, VLC, our offline player) can open it.
 * 2. On the web we stream it with progress, keep a copy in the offline vault for
 *    internet-free playback, and also save it to the browser's Downloads folder.
 * 3. If anything blocks that, we fall back to a plain browser download so the
 *    user never ends up with nothing.
 */
export async function startDownload(item: DownloadItem): Promise<void> {
    const href = withDownloadFlag(item.url, item.fileName);
    upsertDownload({ ...item, status: "downloading", received: 0, error: null, offline: false, updatedAt: Date.now() });
    announce(item);

    const fallback = (message?: string) => {
        triggerBrowserDownload(href, item.fileName);
        patchDownload(item.id, { status: "opened", error: message ?? null });
    };

    // --- Android app: hand it to the phone ---------------------------------
    const { isAndroidApp, nativeDownload, nativeToast } = await import("@/lib/native");
    if (isAndroidApp() && nativeDownload(href, item.fileName, item.fileName.endsWith(".apk") ? "application/vnd.android.package-archive" : "video/mp4")) {
        nativeToast("Download started — check the notification bar");
        patchDownload(item.id, { status: "device", error: null, device: true });
        return;
    }

    if (typeof window === "undefined" || !("fetch" in window)) {
        fallback();
        return;
    }

    try {
        const { requestPersistentStorage, saveOffline } = await import("@/lib/offline");
        void requestPersistentStorage();

        const res = await fetch(href, { credentials: "omit" });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const total = Number(res.headers.get("content-length") ?? 0) || item.size || null;
        patchDownload(item.id, { size: total });

        const reader = res.body.getReader();
        const chunks: BlobPart[] = [];
        let received = 0;
        let lastTick = 0;

        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
                chunks.push(value);
                received += value.byteLength;
                const now = Date.now();
                if (now - lastTick > 400) {
                    lastTick = now;
                    patchDownload(item.id, { received, status: "downloading" });
                }
            }
        }

        const blob = new Blob(chunks, { type: res.headers.get("content-type") ?? "video/mp4" });

        // 1. Keep it in the app so it plays without internet.
        const savedOffline = await saveOffline(item.id, blob, item.fileName);

        // 2. Also drop a copy in the device's Downloads folder.
        const blobUrl = URL.createObjectURL(blob);
        triggerBrowserDownload(blobUrl, item.fileName);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

        patchDownload(item.id, {
            status: "completed",
            received,
            size: total ?? received,
            offline: savedOffline,
            error: savedOffline ? null : "Saved to your device, but offline play storage is full.",
        });
    } catch (err) {
        fallback(err instanceof Error ? err.message : String(err));
    }
}

/** Download the Android APK — inside the app too (DownloadManager). */
/**
 * APK downloads go straight to the browser / Android download manager.
 * They must NOT pass through fetch()+IndexedDB (that produced corrupt blobs).
 */
export async function startApkDownload(_version = "latest"): Promise<void> {
    if (typeof window === "undefined") return;
    const a = document.createElement("a");
    a.href = "/api/apk";
    a.setAttribute("download", "MovieBox.apk");
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export interface ResolvedSource {
    url: string;
    size?: number | null;
    quality?: string | null;
    fileName?: string | null;
}

interface ResolveOptions {
    type?: "movie" | "tv";
    season?: number;
    episode?: number;
    year?: string | number | null;
}

function pad(n: number) {
    return String(n).padStart(2, "0");
}

/** Try Hindi / dual-audio labels first, then English; an unlabelled/original
 * release is the final fallback. */
const LANGUAGE_HINTS = ["Hindi Dual Audio", "Dual Audio", "Hindi Dubbed", "Hindi", "English"];

/** Every sensible way this title could be named in the file library. */
export function titleVariants(title: string, opts: ResolveOptions = {}): string[] {
    const base = title
        .replace(/\s*[Ss]\d{1,2}\s*[Ee]\d{1,3}\s*$/, "")
        .replace(/\s+/g, " ")
        .trim();
    const list: string[] = [];
    const push = (v?: string | null) => {
        const clean = (v ?? "").replace(/\s+/g, " ").trim();
        if (clean && !list.includes(clean)) list.push(clean);
    };

    const { season, episode } = opts;
    const plain = base.replace(/[:\-–—_.,'!?]/g, " ").replace(/\s+/g, " ").trim();

    if (season && episode) {
        const episodeTag = `S${pad(season)}E${pad(episode)}`;
        // Look for dubbed / dual-audio episodes before an English-only print.
        for (const hint of LANGUAGE_HINTS) {
            push(`${base} ${episodeTag} ${hint}`);
            push(`${plain} ${episodeTag} ${hint}`);
            push(`${base} ${season}x${pad(episode)} ${hint}`);
            push(`${base} Season ${season} Episode ${episode} ${hint}`);
        }
        // Unlabelled episode names are the original-audio fallback.
        push(`${base} ${episodeTag}`);
        push(`${plain} ${episodeTag}`);
        push(`${base} ${season}x${pad(episode)}`);
        push(`${base} Season ${season} Episode ${episode}`);
        push(`${base} Episode ${episode}`);
        push(`${base} S${pad(season)}`);
    } else {
        // Language-tagged movies first. The plain title is the original /
        // unlabelled fallback and stays below Hindi and English candidates.
        for (const hint of LANGUAGE_HINTS) push(`${base} ${hint}`);
    }

    push(title);
    push(base);
    push(plain);
    if (opts.year) {
        push(`${base} ${opts.year}`);
        push(`${base} ${opts.year} Hindi`);
    }

    // Progressively shorter titles help when the library uses release names.
    const words = plain.split(" ");
    for (const count of [4, 3, 2]) {
        if (words.length > count) push(words.slice(0, count).join(" "));
    }

    return list;
}

async function tryFind(query: string, opts: ResolveOptions, strict = true): Promise<ResolvedSource | null> {
    const params = new URLSearchParams({ title: query, lang: "hi" });
    if (strict && opts.type) params.set("type", opts.type);
    if (strict && opts.season) params.set("season", String(opts.season));
    if (strict && opts.episode) params.set("episode", String(opts.episode));
    try {
        const res = await fetch(`/api/movies/find?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        const movie = Array.isArray(data) ? data[0] : (data?.result ?? data?.movie ?? data);
        if (!movie || typeof movie !== "object") return null;
        const fileId = movie?.fileId ?? movie?.file_id ?? movie?._id ?? movie?.id;
        const url: string | null =
            movie?.downloadUrl ??
            movie?.download_url ??
            movie?.streamUrl ??
            movie?.stream_url ??
            (fileId ? `/api/stream/${encodeURIComponent(String(fileId))}` : null);
        if (!url) return null;
        return {
            url,
            size: movie?.fileSize ?? movie?.file_size ?? null,
            quality: movie?.quality ?? null,
            fileName: movie?.file_name ?? movie?.caption ?? movie?.title ?? null,
        };
    } catch {
        return null;
    }
}

/**
 * Ask the backend for a downloadable source. Tries Hindi spellings, episode-aware
 * names and shortened titles, then repeats everything without the strict
 * type/season filters — that loose pass is what fixes most
 * "file not found / not available for download" reports.
 */
export async function resolveSource(
    title: string,
    opts: ResolveOptions = {},
): Promise<ResolvedSource | null> {
    if (!title) return null;
    const queries = titleVariants(title, opts);
    for (const query of queries) {
        const hit = await tryFind(query, opts, true);
        if (hit) return hit;
    }
    for (const query of queries) {
        const hit = await tryFind(query, opts, false);
        if (hit) return hit;
    }
    return null;
}
