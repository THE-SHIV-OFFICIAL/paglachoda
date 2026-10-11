import { NextResponse } from "next/server";
import { findEntry } from "@/lib/library";

/**
 * Finds a downloadable file for a title.
 * - If INTERNAL_API_URL is set, the request is proxied to that API server.
 * - Otherwise the built-in library (admin → /admin/library) is used.
 */
const API_BASE = process.env.INTERNAL_API_URL;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const incoming = new URL(request.url);

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/movies/find?${incoming.searchParams.toString()}`, { cache: "no-store" });
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
      });
    } catch {
      return NextResponse.json({ error: "Library is unreachable right now." }, { status: 502 });
    }
  }

  try {
    const p = incoming.searchParams;
    const entry = await findEntry(p.get("title") ?? "", {
      type: p.get("type"),
      season: p.get("season") ? Number(p.get("season")) : undefined,
      episode: p.get("episode") ? Number(p.get("episode")) : undefined,
    });
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      fileId: entry.id,
      fileSize: entry.size ?? null,
      quality: entry.quality,
      file_name: entry.fileName ?? entry.title,
    });
  } catch {
    return NextResponse.json({ error: "Library is unreachable right now." }, { status: 502 });
  }
}
