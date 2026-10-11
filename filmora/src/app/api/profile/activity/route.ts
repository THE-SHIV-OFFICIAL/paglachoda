import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSessionToken } from "@/lib/authServer";
import { addActivity, toPublicProfile } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { seconds, playSeconds } — adds active time to the signed-in user's score. */
export async function POST(request: Request) {
  const store = await cookies();
  const session = readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ profile: null }, { status: 401 });

  let body: { seconds?: number; playSeconds?: number } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }

  const seconds = Number(body.seconds ?? 0);
  const playSeconds = Number(body.playSeconds ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return NextResponse.json({ ok: true });
  }

  const updated = await addActivity(session.email, seconds, Number.isFinite(playSeconds) ? playSeconds : 0);
  return NextResponse.json({ profile: toPublicProfile(session.email, updated) });
}
