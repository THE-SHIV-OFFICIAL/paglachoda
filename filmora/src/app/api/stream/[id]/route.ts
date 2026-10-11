import { NextResponse } from "next/server";
import { getEntry } from "@/lib/library";
import { streamTelegram, tgConfigured } from "@/lib/tgStream";

/**
 * Streams / downloads a library file through the API server. Supports Range
 * requests so the browser can seek and resume, and forwards the attachment
 * header when the download flag (?dl=1) is present.
 */
const API_BASE = process.env.INTERNAL_API_URL;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const incoming = new URL(request.url);
  const search = incoming.searchParams.toString();

  const headers: Record<string, string> = {};
  const range = request.headers.get("range");
  if (range) headers["Range"] = range;

  try {
    let target: string;
    if (API_BASE) {
      target = `${API_BASE}/stream/${encodeURIComponent(id)}${search ? `?${search}` : ""}`;
    } else {
      const entry = await getEntry(id);
      if (!entry) return NextResponse.json({ error: "File not found." }, { status: 404 });
      target = entry.url;
      if (target.startsWith("tg:")) {
        const fileId = target.slice(3);
        // 0) Built-in streamer: plays straight from Telegram, any size, no extra server.
        if (tgConfigured() && entry.size) {
          const mime = entry.mime === "video/x-matroska" ? "video/webm" : entry.mime;
          const dl = incoming.searchParams.get("dl") === "1" ? (incoming.searchParams.get("name") || entry.fileName || "movie.mkv") : null;
          return await streamTelegram({ fileId, fileRef: entry.fileRef, size: entry.size, mime, range, download: dl });
        }
        // 1) Your own Telegram stream server (e.g. a File-Stream bot): TG_STREAM_URL=https://host/dl/{file_id}
        const tpl = process.env.TG_STREAM_URL;
        if (tpl) {
          const url = tpl.includes("{file_id}") ? tpl.replace("{file_id}", encodeURIComponent(fileId)) : `${tpl.replace(/\/$/, "")}/${encodeURIComponent(fileId)}`;
          return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
        }
        // 2) Telegram Bot API (Telegram only allows files up to 20 MB this way). Proxied so the token stays private.
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return NextResponse.json({ error: "Telegram streaming is not configured (set TG_STREAM_URL or TELEGRAM_BOT_TOKEN)." }, { status: 501 });
        const info = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
        if (!info?.ok) return NextResponse.json({ error: info?.description ?? "Telegram file not reachable (files over 20 MB need TG_STREAM_URL)." }, { status: 502 });
        target = `https://api.telegram.org/file/bot${token}/${info.result.file_path}`;
      }
      // Playback: send the player straight to the file host (302) so video
      // bandwidth never passes through this server. Downloads (?dl=1) stay
      // proxied so the attachment filename header can be set.
      if (incoming.searchParams.get("dl") !== "1" && /^https?:\/\//i.test(target) && !target.includes("api.telegram.org")) {
        return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store" } });
      }
    }
    const upstream = await fetch(
      target,
      { headers, cache: "no-store", redirect: "follow" },
    );

    const out = new Headers();
    for (const key of [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "content-disposition",
      "cache-control",
    ]) {
      const value = upstream.headers.get(key);
      if (value) out.set(key, value);
    }
    if (!out.has("accept-ranges")) out.set("accept-ranges", "bytes");

    const name = incoming.searchParams.get("name");
    if (incoming.searchParams.get("dl") === "1" && name && !out.has("content-disposition")) {
      out.set("content-disposition", `attachment; filename="${name.replace(/"/g, "")}"`);
    }

    return new NextResponse(upstream.body, { status: upstream.status, headers: out });
  } catch {
    return NextResponse.json({ error: "This file is not reachable right now." }, { status: 502 });
  }
}
