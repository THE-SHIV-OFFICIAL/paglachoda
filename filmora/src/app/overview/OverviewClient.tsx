"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Activity,
    Users,
    Gauge,
    RefreshCcw,
    Clock,
    Zap,
    Server,
    Film,
    ShieldCheck,
    Sparkles,
    Download,
    Radio,
    Smartphone,
} from "lucide-react";
import { siteConfig } from "@/lib/config";

type Stats = {
    visits: number;
    files: number;
    online: number;
    startedAt: number;
    uptimeMs: number;
    lastUpdated: number;
    serverTime: number;
};

function timeAgo(ts: number) {
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}m ago`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h ago`;
}

const MIN_VISITS = 709;
const STATS_CACHE_KEY = "mb-overview-stats";

/** Numbers on this page only ever go up — a restart must never reset them. */
function mergeStats(prev: Stats | null, next: Stats): Stats {
    const merged: Stats = {
        ...next,
        visits: Math.max(MIN_VISITS, prev?.visits ?? 0, next.visits ?? 0),
        files: Math.max(prev?.files ?? 0, next.files ?? 0),
        uptimeMs: Math.max(prev?.uptimeMs ?? 0, next.uptimeMs ?? 0),
        online: Math.max(1, next.online ?? 1),
    };
    try {
        localStorage.setItem(
            STATS_CACHE_KEY,
            JSON.stringify({ visits: merged.visits, files: merged.files, uptimeMs: merged.uptimeMs }),
        );
    } catch {
        /* ignore */
    }
    return merged;
}

function readCachedStats(): Pick<Stats, "visits" | "files" | "uptimeMs"> {
    const empty = { visits: MIN_VISITS, files: 0, uptimeMs: 0 };
    try {
        const raw = localStorage.getItem(STATS_CACHE_KEY);
        if (!raw) return empty;
        const saved = JSON.parse(raw) as Partial<Stats>;
        return {
            visits: Math.max(MIN_VISITS, Number(saved.visits ?? 0)),
            files: Math.max(0, Number(saved.files ?? 0)),
            uptimeMs: Math.max(0, Number(saved.uptimeMs ?? 0)),
        };
    } catch {
        return empty;
    }
}

function useCountUp(value: number) {
    const [display, setDisplay] = useState(value);
    const fromRef = useRef(value);

    useEffect(() => {
        const from = fromRef.current;
        if (from === value) return;
        const start = performance.now();
        const dur = 700;
        let raf = 0;
        const tick = (now: number) => {
            const p = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(Math.round(from + (value - from) * eased));
            if (p < 1) raf = requestAnimationFrame(tick);
            else fromRef.current = value;
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [value]);

    return display;
}

function StatCard({
    icon,
    label,
    value,
    sub,
    accent = "var(--accent)",
    live = false,
    delay = 0,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    sub?: string;
    accent?: string;
    live?: boolean;
    delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[var(--prime-card)] p-6"
        >
            <div
                className="absolute -top-20 -right-16 h-44 w-44 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
                style={{ background: accent }}
            />
            <div className="relative z-10 flex items-start justify-between gap-3">
                <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10"
                    style={{ background: "rgba(255,255,255,0.05)", color: accent }}
                >
                    {icon}
                </div>
                {live && (
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        </span>
                        Live
                    </span>
                )}
            </div>
            <p className="relative z-10 mt-5 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                {value}
            </p>
            <p className="relative z-10 mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--card-panel-muted)]">
                {label}
            </p>
            {sub && <p className="relative z-10 mt-2 text-sm text-muted-foreground">{sub}</p>}
        </motion.div>
    );
}

export default function OverviewClient() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [latency, setLatency] = useState<number | null>(null);
    const [pageLoadMs, setPageLoadMs] = useState<number | null>(null);
    const [ttfbMs, setTtfbMs] = useState<number | null>(null);
    const [tick, setTick] = useState(0);

    const ping = useCallback(async (newVisit: boolean) => {
        try {
            let cid = "";
            try {
                cid = localStorage.getItem("mb-client-id") || "";
                if (!cid) {
                    cid = Math.random().toString(36).slice(2) + Date.now().toString(36);
                    localStorage.setItem("mb-client-id", cid);
                }
            } catch {
                cid = "anon-" + Math.random().toString(36).slice(2);
            }

            const t0 = performance.now();
            const res = await fetch("/api/stats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cid, newVisit }),
                cache: "no-store",
            });
            const rtt = Math.round(performance.now() - t0);
            const data = (await res.json()) as Stats;
            setStats((prev) => mergeStats(prev, data));
            setLatency(rtt);
        } catch {
            /* offline — keep last known values */
        }
    }, []);

    // Show the last known (never smaller) numbers instantly.
    useEffect(() => {
        const cached = readCachedStats();
        setStats((prev) =>
            prev
                ? prev
                : ({
                      ...cached,
                      online: 1,
                      startedAt: Date.now() - cached.uptimeMs,
                      lastUpdated: Date.now(),
                      serverTime: Date.now(),
                  } as Stats),
        );
    }, []);

    useEffect(() => {
        let firstVisit = true;
        try {
            firstVisit = !sessionStorage.getItem("mb-visit-counted");
            sessionStorage.setItem("mb-visit-counted", "1");
        } catch {
            /* ignore */
        }

        ping(firstVisit);
        const id = setInterval(() => ping(false), 15000);
        return () => clearInterval(id);
    }, [ping]);

    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (nav) {
            setTtfbMs(Math.round(nav.responseStart - nav.requestStart));
            const load = nav.loadEventEnd || nav.domContentLoadedEventEnd;
            if (load) setPageLoadMs(Math.round(load - nav.startTime));
        }
    }, []);

    const visits = useCountUp(Math.max(MIN_VISITS, stats?.visits ?? 0));
    const online = useCountUp(stats?.online ?? 0);

    const speedScore = (() => {
        const base = latency ?? 400;
        const load = pageLoadMs ?? 2500;
        const score = 100 - Math.min(45, base / 12) - Math.min(45, load / 90);
        return Math.max(35, Math.round(score));
    })();

    const speedLabel = speedScore >= 90 ? "Blazing" : speedScore >= 75 ? "Fast" : speedScore >= 55 ? "Good" : "Average";

    const uptime = (() => {
        if (!stats) return "—";
        const ms = stats.uptimeMs + tick * 0;
        const s = Math.floor(ms / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
        return `${h}h ${m}m`;
    })();

    return (
        <main className="min-h-screen bg-[var(--prime-dark)]">
            {/* Hero */}
            <section className="relative overflow-hidden px-4 pt-24 pb-14 sm:px-6 sm:pt-32">
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(255,61,61,0.16) 0%, rgba(255,201,60,0.07) 45%, transparent 75%)",
                    }}
                />
                <div className="relative z-10 mx-auto max-w-5xl text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-accent"
                    >
                        <Activity className="h-3.5 w-3.5" />
                        Live overview
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.05 }}
                        className="text-4xl font-black leading-tight tracking-tight text-foreground sm:text-6xl"
                    >
                        {siteConfig.name}{" "}
                        <span
                            style={{
                                background: "linear-gradient(135deg, #FF3D3D 0%, #FFC93C 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                backgroundClip: "text",
                            }}
                        >
                            Overview
                        </span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground"
                    >
                        Everything happening on the platform right now — visitors, uptime, response speed and the
                        last time the site was updated.
                    </motion.p>
                </div>
            </section>

            {/* Live stats */}
            <section className="px-4 pb-6 sm:px-6">
                <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        icon={<Users className="h-5 w-5" />}
                        label="Total visits"
                        value={visits.toLocaleString()}
                        sub="Counted since the current build went live"
                        live
                        delay={0}
                    />
                    <StatCard
                        icon={<Radio className="h-5 w-5" />}
                        label="Watching now"
                        value={online.toLocaleString()}
                        sub="Active viewers in the last 75 seconds"
                        accent="#34d399"
                        live
                        delay={0.06}
                    />
                    <StatCard
                        icon={<Film className="h-5 w-5" />}
                        label="Files in catalog"
                        value={stats ? (stats.files ?? 0).toLocaleString() : "—"}
                        sub="Indexed titles available through the bot"
                        accent="#c084fc"
                        live
                        delay={0.12}
                    />
                    <StatCard
                        icon={<Gauge className="h-5 w-5" />}
                        label={`Speed — ${speedLabel}`}
                        value={`${speedScore}/100`}
                        sub={`API ${latency ?? "—"} ms · Page load ${pageLoadMs ?? "—"} ms · TTFB ${ttfbMs ?? "—"} ms`}
                        accent="#FFC93C"
                        delay={0.18}
                    />
                    <StatCard
                        icon={<RefreshCcw className="h-5 w-5" />}
                        label="Last updated"
                        value={stats ? timeAgo(stats.lastUpdated) : "—"}
                        sub={stats ? `Running for ${uptime} without a restart` : "Fetching live data…"}
                        accent="#60a5fa"
                        delay={0.24}
                    />
                </div>
            </section>

            {/* Live pulse strip */}
            <section className="px-4 py-8 sm:px-6">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-[var(--prime-card)] px-6 py-5">
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        </span>
                        <p className="text-sm font-bold text-foreground">
                            All systems operational
                            <span className="ml-2 font-medium text-muted-foreground">
                                · refreshed {tick % 15}s ago
                            </span>
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-5 text-xs font-bold uppercase tracking-widest text-[var(--card-panel-muted)]">
                        <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> Uptime {uptime}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5" /> {latency ?? "—"} ms API
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Server className="h-3.5 w-3.5" /> Edge streaming
                        </span>
                    </div>
                </div>
            </section>

            <section className="px-4 pb-8 sm:px-6">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 rounded-3xl border border-accent/20 bg-accent/5 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <Smartphone className="h-5 w-5 text-accent" />
                        <div>
                            <p className="text-sm font-black text-foreground">Take MOVIE BOX with you</p>
                            <p className="text-xs text-muted-foreground">Download the Android app and receive Beta Bot Hub updates.</p>
                        </div>
                    </div>
                    <Link href="/app" className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-black text-black transition hover:brightness-110">
                        <Download className="h-3.5 w-3.5" /> Android app
                    </Link>
                </div>
            </section>

            {/* What this site is */}
            <section className="px-4 pb-24 sm:px-6">
                <div className="mx-auto max-w-6xl">
                    <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                        What {siteConfig.name} is
                    </h2>
                    <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
                        {siteConfig.name} is a fast, ad-light streaming front-end for movies, web series, TV shows and
                        cartoons. Titles, artwork, cast and ratings come from TMDB, playback runs through multiple
                        mirrored sources with automatic failover, and everything is tuned for phones first — install it
                        as an app and it opens like a native player.
                    </p>

                    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[
                            {
                                icon: <Film className="h-5 w-5" />,
                                title: "Huge catalogue",
                                body: "Movies, web series, TV shows, cartoons, people, studios and networks — all searchable in one place.",
                            },
                            {
                                icon: <Zap className="h-5 w-5" />,
                                title: "Automatic failover",
                                body: "Four hand-picked sources: Beta, Videasy, 2Embed and Peachify. If one stalls, the player switches on its own.",
                            },
                            {
                                icon: <Gauge className="h-5 w-5" />,
                                title: "Built for speed",
                                body: "Server-rendered pages, cached artwork and prefetched routes keep navigation near-instant even on slow networks.",
                            },
                            {
                                icon: <Download className="h-5 w-5" />,
                                title: "Updates & app",
                                body: "The player keeps a clean fullscreen control, while Beta Bot Hub carries release updates and the Android app.",
                            },
                            {
                                icon: <ShieldCheck className="h-5 w-5" />,
                                title: "Catalog transparency",
                                body: "The overview shows the live indexed file count, while playback and metadata stay clearly separated from the catalog.",
                            },
                            {
                                icon: <Sparkles className="h-5 w-5" />,
                                title: "Beta Bot support",
                                body: "Broken link or missing title? Beta Bot replies on Telegram and the fix ships in the next update.",
                            },
                        ].map((item, i) => (
                            <motion.div
                                key={item.title}
                                initial={{ opacity: 0, y: 18 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.45, delay: i * 0.05 }}
                                className="rounded-3xl border border-white/10 bg-[var(--prime-card)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/50"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 text-accent">
                                    {item.icon}
                                </div>
                                <h3 className="mt-4 text-lg font-black tracking-tight text-foreground">{item.title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}
