"use client";

/**
 * Time-spent tracking. Counts only the seconds the tab is actually visible,
 * keeps a local copy (so the score also works while signed out / offline)
 * and flushes the delta to the server every 30 seconds.
 */

const LS_PREFIX = process.env.NEXT_PUBLIC_LS_PREFIX ?? "mb_";
const LOCAL_KEY = `${LS_PREFIX}activity`;

export interface LocalActivity {
    seconds: number;
    playSeconds: number;
    days: string[];
    pendingSeconds: number;
    pendingPlaySeconds: number;
}

export const ACTIVITY_EVENT = "activityUpdated";

const empty: LocalActivity = {
    seconds: 0,
    playSeconds: 0,
    days: [],
    pendingSeconds: 0,
    pendingPlaySeconds: 0,
};

export function readActivity(): LocalActivity {
    if (typeof window === "undefined") return empty;
    try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (!raw) return { ...empty };
        const parsed = JSON.parse(raw) as Partial<LocalActivity>;
        return { ...empty, ...parsed, days: Array.isArray(parsed.days) ? parsed.days : [] };
    } catch {
        return { ...empty };
    }
}

function writeActivity(next: LocalActivity) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    } catch {
        /* quota — ignore */
    }
    window.dispatchEvent(new Event(ACTIVITY_EVENT));
}

/** Add visible seconds; `playing` marks time spent on a watch page. */
export function addLocalActivity(seconds: number, playing: boolean) {
    if (seconds <= 0) return;
    const cur = readActivity();
    const today = new Date().toISOString().slice(0, 10);
    const days = cur.days.includes(today) ? cur.days : [...cur.days, today].slice(-400);
    writeActivity({
        seconds: cur.seconds + seconds,
        playSeconds: cur.playSeconds + (playing ? seconds : 0),
        days,
        pendingSeconds: cur.pendingSeconds + seconds,
        pendingPlaySeconds: cur.pendingPlaySeconds + (playing ? seconds : 0),
    });
}

/** Send pending seconds to the server; clears them when accepted. */
export async function flushActivity(useBeacon = false): Promise<void> {
    const cur = readActivity();
    if (cur.pendingSeconds <= 0) return;
    const payload = JSON.stringify({
        seconds: cur.pendingSeconds,
        playSeconds: cur.pendingPlaySeconds,
    });

    const clear = () =>
        writeActivity({ ...readActivity(), pendingSeconds: 0, pendingPlaySeconds: 0 });

    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
        const ok = navigator.sendBeacon(
            "/api/profile/activity",
            new Blob([payload], { type: "application/json" }),
        );
        if (ok) clear();
        return;
    }

    try {
        const res = await fetch("/api/profile/activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
        });
        // 401 = signed out: keep the local score, drop the pending sync queue
        // so it does not grow forever.
        if (res.ok || res.status === 401) clear();
    } catch {
        /* offline — retry on the next flush */
    }
}

export function localScore(a: LocalActivity = readActivity()): number {
    return (
        Math.floor(a.seconds / 60) + Math.floor(a.playSeconds / 60) * 2 + a.days.length * 25
    );
}

export function formatDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}
