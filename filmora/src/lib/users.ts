import type { SessionUser } from "@/lib/authServer";

/**
 * User persistence. Uses MongoDB when MONGODB_URI is set (same cluster that
 * holds the movie catalogue), otherwise an in-memory map so the site still
 * runs in demo mode.
 */

export interface StoredUser extends SessionUser {
  email: string;
  name: string;
  username?: string;
  picture?: string;
  createdAt: string;
  lastLoginAt: string;
  loginCount: number;
  /** Total seconds the user has actively spent in the app. */
  watchSeconds?: number;
  /** Seconds spent inside the player (watch pages). */
  playSeconds?: number;
  /** Loyalty score derived from time spent + visits. */
  score?: number;
  /** Number of distinct days the user opened the app (YYYY-MM-DD list, capped). */
  activeDays?: string[];
}

export interface PublicProfile {
  email: string;
  name: string;
  username: string;
  picture: string | null;
  memberSince: string | null;
  loginCount: number;
  watchSeconds: number;
  playSeconds: number;
  score: number;
  activeDays: number;
}

const mem = globalThis as unknown as { __mbUsers?: Map<string, StoredUser> };
const memUsers: Map<string, StoredUser> = mem.__mbUsers ?? new Map();
mem.__mbUsers = memUsers;

async function collection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  try {
    const { MongoClient } = await import("mongodb");
    const cache = globalThis as unknown as { __mbMongo?: Promise<InstanceType<typeof MongoClient>> };
    if (!cache.__mbMongo) cache.__mbMongo = new MongoClient(uri).connect();
    const client = await cache.__mbMongo;
    return client.db(process.env.MONGODB_DB ?? "moviebox").collection<StoredUser>("users");
  } catch {
    return null;
  }
}

/** Score formula: 1 point per minute in the app, 2 per minute watching, 25 per active day. */
export function computeScore(user: Partial<StoredUser>): number {
  const app = Math.floor((user.watchSeconds ?? 0) / 60);
  const play = Math.floor((user.playSeconds ?? 0) / 60) * 2;
  const days = (user.activeDays?.length ?? 0) * 25;
  return app + play + days;
}

export function slugifyUsername(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 20);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readUser(email: string): Promise<StoredUser | null> {
  const key = email.toLowerCase();
  const col = await collection();
  if (col) return (await col.findOne({ email: key })) ?? null;
  return memUsers.get(key) ?? null;
}

async function writeUser(user: StoredUser): Promise<StoredUser> {
  const col = await collection();
  if (col) {
    await col.updateOne({ email: user.email }, { $set: user }, { upsert: true });
  } else {
    memUsers.set(user.email, user);
  }
  return user;
}

export async function upsertUser(user: SessionUser): Promise<StoredUser> {
  const email = user.email.toLowerCase();
  const now = new Date().toISOString();
  const existing = await readUser(email);

  const days = new Set(existing?.activeDays ?? []);
  days.add(todayKey());

  const doc: StoredUser = {
    email,
    name: existing?.name || user.name || email.split("@")[0],
    username: existing?.username || slugifyUsername(email.split("@")[0]) || "user",
    picture: existing?.picture ?? user.picture,
    createdAt: existing?.createdAt ?? now,
    lastLoginAt: now,
    loginCount: (existing?.loginCount ?? 0) + 1,
    watchSeconds: existing?.watchSeconds ?? 0,
    playSeconds: existing?.playSeconds ?? 0,
    activeDays: [...days].slice(-400),
  };
  doc.score = computeScore(doc);
  return writeUser(doc);
}

export async function getUser(email: string): Promise<StoredUser | null> {
  return readUser(email);
}

export function toPublicProfile(email: string, user: StoredUser | null): PublicProfile {
  return {
    email,
    name: user?.name ?? email.split("@")[0],
    username: user?.username ?? slugifyUsername(email.split("@")[0]) ?? "user",
    picture: user?.picture ?? null,
    memberSince: user?.createdAt ?? null,
    loginCount: user?.loginCount ?? 1,
    watchSeconds: user?.watchSeconds ?? 0,
    playSeconds: user?.playSeconds ?? 0,
    score: user?.score ?? computeScore(user ?? {}),
    activeDays: user?.activeDays?.length ?? 1,
  };
}

export async function isUsernameTaken(username: string, exceptEmail: string): Promise<boolean> {
  const key = username.toLowerCase();
  const col = await collection();
  if (col) {
    const hit = await col.findOne({ username: key });
    return !!hit && hit.email !== exceptEmail.toLowerCase();
  }
  for (const u of memUsers.values()) {
    if (u.username === key && u.email !== exceptEmail.toLowerCase()) return true;
  }
  return false;
}

export interface ProfilePatch {
  name?: string;
  username?: string;
  picture?: string | null;
}

export async function updateProfile(email: string, patch: ProfilePatch): Promise<StoredUser> {
  const key = email.toLowerCase();
  const now = new Date().toISOString();
  const existing = (await readUser(key)) ?? {
    email: key,
    name: key.split("@")[0],
    createdAt: now,
    lastLoginAt: now,
    loginCount: 1,
    watchSeconds: 0,
    playSeconds: 0,
    activeDays: [todayKey()],
  } as StoredUser;

  const doc: StoredUser = { ...existing };
  if (typeof patch.name === "string" && patch.name.trim()) doc.name = patch.name.trim().slice(0, 40);
  if (typeof patch.username === "string" && patch.username.trim()) doc.username = slugifyUsername(patch.username);
  if (patch.picture === null) delete doc.picture;
  else if (typeof patch.picture === "string" && patch.picture) doc.picture = patch.picture;
  doc.score = computeScore(doc);
  return writeUser(doc);
}

/** Add active time. Returns the updated profile. */
export async function addActivity(
  email: string,
  seconds: number,
  playSeconds = 0,
): Promise<StoredUser> {
  const key = email.toLowerCase();
  const now = new Date().toISOString();
  const existing = (await readUser(key)) ?? {
    email: key,
    name: key.split("@")[0],
    username: slugifyUsername(key.split("@")[0]) || "user",
    createdAt: now,
    lastLoginAt: now,
    loginCount: 1,
    watchSeconds: 0,
    playSeconds: 0,
    activeDays: [],
  } as StoredUser;

  const safe = Math.max(0, Math.min(3600, Math.round(seconds)));
  const safePlay = Math.max(0, Math.min(safe, Math.round(playSeconds)));
  const days = new Set(existing.activeDays ?? []);
  days.add(todayKey());

  const doc: StoredUser = {
    ...existing,
    watchSeconds: (existing.watchSeconds ?? 0) + safe,
    playSeconds: (existing.playSeconds ?? 0) + safePlay,
    activeDays: [...days].slice(-400),
    lastLoginAt: now,
  };
  doc.score = computeScore(doc);
  return writeUser(doc);
}
