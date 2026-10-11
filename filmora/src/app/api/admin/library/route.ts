import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/adminAuth";
import { addEntry, listLibrary, removeEntry } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const ok = (req: NextRequest) => verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);

export async function GET(req: NextRequest) {
  if (!ok(req)) return unauthorized();
  return NextResponse.json({ items: await listLibrary() });
}

export async function POST(req: NextRequest) {
  if (!ok(req)) return unauthorized();
  const b = await req.json().catch(() => null);
  const title = String(b?.title ?? "").trim();
  const url = String(b?.url ?? "").trim();
  if (!title || !/^https?:\/\//i.test(url))
    return NextResponse.json({ error: "Title and a valid http(s) file URL are required." }, { status: 400 });
  const type = b?.type === "tv" ? "tv" : "movie";
  const entry = await addEntry({
    title,
    url,
    type,
    quality: ["480p", "720p", "1080p"].includes(b?.quality) ? b.quality : "720p",
    season: type === "tv" && b?.season ? Number(b.season) : null,
    episode: type === "tv" && b?.episode ? Number(b.episode) : null,
    size: b?.size ? Number(b.size) : null,
    fileName: b?.fileName ? String(b.fileName) : null,
  });
  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!ok(req)) return unauthorized();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await removeEntry(id);
  return NextResponse.json({ ok: true });
}
