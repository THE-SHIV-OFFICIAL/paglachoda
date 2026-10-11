import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSessionToken } from "@/lib/authServer";
import {
  getUser,
  isUsernameTaken,
  slugifyUsername,
  toPublicProfile,
  updateProfile,
} from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PICTURE_CHARS = 400_000; // ~300 KB image as a data URL

async function session() {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function GET() {
  const s = await session();
  if (!s) return NextResponse.json({ profile: null }, { status: 401 });
  const user = await getUser(s.email);
  return NextResponse.json({ profile: toPublicProfile(s.email, user) });
}

export async function PATCH(request: Request) {
  const s = await session();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { name?: string; username?: string; picture?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof body.name === "string" && body.name.trim().length > 40) {
    return NextResponse.json({ error: "Name must be 40 characters or less." }, { status: 400 });
  }

  if (typeof body.username === "string") {
    const uname = slugifyUsername(body.username);
    if (uname.length < 3) {
      return NextResponse.json(
        { error: "Username needs at least 3 letters, numbers, dots or underscores." },
        { status: 400 },
      );
    }
    if (await isUsernameTaken(uname, s.email)) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    body.username = uname;
  }

  if (typeof body.picture === "string" && body.picture) {
    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(body.picture)) {
      return NextResponse.json({ error: "Unsupported image format." }, { status: 400 });
    }
    if (body.picture.length > MAX_PICTURE_CHARS) {
      return NextResponse.json({ error: "Image is too large — pick a smaller photo." }, { status: 413 });
    }
  }

  const updated = await updateProfile(s.email, {
    name: body.name,
    username: body.username,
    picture: body.picture,
  });

  return NextResponse.json({ profile: toPublicProfile(s.email, updated) });
}
