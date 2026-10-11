import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import os from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live site stats.
 *
 * Visits, files and uptime are *monotonic*: they are persisted to disk and can
 * only ever go up, so a server restart or a new deploy never resets the numbers
 * shown on /overview. Visits also never drop below MIN_VISITS.
 */

const MIN_VISITS = 709;
const ONLINE_WINDOW_MS = 75_000;
const API_BASE = process.env.INTERNAL_API_URL ?? "http://localhost:80/api";
const STATE_DIR = process.env.STATS_DIR ?? path.join(os.tmpdir(), "moviebox-stats");
const STATE_FILE = path.join(STATE_DIR, "stats.json");

type Persisted = { visits: number; startedAt: number; files: number };

type StatsStore = Persisted & {
    online: Map<string, number>;
    loaded: boolean;
    dirty: boolean;
};

function getStore(): StatsStore {
    const g = globalThis as unknown as { __mbStats?: StatsStore };
    if (!g.__mbStats) {
        g.__mbStats = {
            visits: MIN_VISITS,
            startedAt: Date.now(),
            files: 0,
            online: new Map<string, number>(),
            loaded: false,
            dirty: false,
        };
    }
    return g.__mbStats;
}

async function load(store: StatsStore) {
    if (store.loaded) return;
    store.loaded = true;
    try {
        const raw = await readFile(STATE_FILE, "utf8");
        const saved = JSON.parse(raw) as Partial<Persisted>;
        store.visits = Math.max(store.visits, Number(saved.visits ?? 0), MIN_VISITS);
        store.files = Math.max(store.files, Number(saved.files ?? 0));
        if (saved.startedAt && Number(saved.startedAt) > 0) {
            // Keep the original "live since" date so uptime keeps growing.
            store.startedAt = Math.min(store.startedAt, Number(saved.startedAt));
        }
    } catch {
        /* first run — nothing saved yet */
    }
}

async function persist(store: StatsStore) {
    if (!store.dirty) return;
    store.dirty = false;
    try {
        await mkdir(STATE_DIR, { recursive: true });
        const data: Persisted = {
            visits: store.visits,
            startedAt: store.startedAt,
            files: store.files,
        };
        await writeFile(STATE_FILE, JSON.stringify(data), "utf8");
    } catch {
        /* read-only filesystem — in-memory values still only go up */
    }
}

function prune(store: StatsStore) {
    const cutoff = Date.now() - ONLINE_WINDOW_MS;
    for (const [id, seen] of store.online) {
        if (seen < cutoff) store.online.delete(id);
    }
}

async function refreshFileCount(store: StatsStore) {
    try {
        const res = await fetch(`${API_BASE}/movies/stats`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { total?: number };
        const total = Number(data.total ?? 0);
        if (total > store.files) {
            store.files = total;
            store.dirty = true;
        }
    } catch {
        /* keep the last known count instead of showing 0 */
    }
}

async function payload(store: StatsStore) {
    await load(store);
    prune(store);
    await refreshFileCount(store);
    if (store.visits < MIN_VISITS) {
        store.visits = MIN_VISITS;
        store.dirty = true;
    }
    await persist(store);

    return {
        visits: store.visits,
        online: Math.max(1, store.online.size),
        startedAt: store.startedAt,
        uptimeMs: Date.now() - store.startedAt,
        lastUpdated: store.startedAt,
        serverTime: Date.now(),
        files: store.files,
        minVisits: MIN_VISITS,
    };
}

export async function GET() {
    return NextResponse.json(await payload(getStore()), {
        headers: { "Cache-Control": "no-store" },
    });
}

export async function POST(request: Request) {
    const store = getStore();
    await load(store);

    let clientId = "anon";
    let isNewVisit = false;

    try {
        const body = (await request.json()) as { cid?: string; newVisit?: boolean };
        if (body?.cid) clientId = String(body.cid).slice(0, 64);
        isNewVisit = Boolean(body?.newVisit);
    } catch {
        /* ignore malformed body */
    }

    if (isNewVisit) {
        store.visits += 1;
        store.dirty = true;
    }
    store.online.set(clientId, Date.now());

    return NextResponse.json(await payload(store), {
        headers: { "Cache-Control": "no-store" },
    });
}
