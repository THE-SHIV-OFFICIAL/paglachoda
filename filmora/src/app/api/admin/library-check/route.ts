import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/adminAuth";
import { inspectLibrary } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only: shows which MongoDB collection/fields hold your movies. */
export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await inspectLibrary());
  } catch (e) {
    return NextResponse.json({ connected: false, reason: (e as Error).message }, { status: 502 });
  }
}
