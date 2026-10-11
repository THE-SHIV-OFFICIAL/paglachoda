import { NextResponse } from "next/server";
import { findSources } from "@/lib/library";

/** Lists every playable file (quality + language) for a title. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  try {
    const sources = await findSources(p.get("title") ?? "", {
      type: p.get("type"),
      season: p.get("season") ? Number(p.get("season")) : undefined,
      episode: p.get("episode") ? Number(p.get("episode")) : undefined,
    });
    return NextResponse.json({ sources: sources.map((s) => ({ ...s, url: `/api/stream/${encodeURIComponent(s.id)}` })) });
  } catch {
    return NextResponse.json({ sources: [], error: "Library is unreachable right now." }, { status: 502 });
  }
}
