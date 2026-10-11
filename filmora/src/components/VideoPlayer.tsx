"use client";

/**
 * MOVIE BOX custom player — zero third-party embeds, zero ads by default.
 * Plays direct MP4/WebM streams from the library (/api/movies/sources).
 * MX/VLC-style controls: quality + audio language switch (keeps position),
 * speed, aspect ratio, lock, double-tap ±10s, swipe gestures for brightness /
 * volume / seek, keyboard shortcuts for PC & TV remotes, resume playback.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, Lock, Unlock,
    RotateCcw, RotateCw, Loader2, Film, Sun, ChevronLeft,
} from "lucide-react";
import { saveToRecentlyPlayed } from "@/lib/storage";
import Dropdown from "@/components/ui/Dropdown";
import { siteConfig } from "@/lib/config";

interface VideoPlayerProps {
    type: "movie" | "tv";
    id: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tmdbData: any;
    season?: number;
    episode?: number;
    initialServer?: number;
    onSeasonChange?: (season: number) => void;
    onEpisodeChange?: (episode: number) => void;
}

interface Source {
    id: string;
    url: string;
    quality: string;
    language: string;
    label: string;
}

type Fit = "contain" | "cover" | "fill";
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const FITS: Array<{ v: Fit; l: string }> = [
    { v: "contain", l: "Original" },
    { v: "cover", l: "Crop" },
    { v: "fill", l: "Stretch" },
];
const LANG_KEY = "mb-player-lang";

function fmt(t: number) {
    if (!Number.isFinite(t) || t < 0) t = 0;
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    const mm = h ? String(m).padStart(2, "0") : String(m);
    return `${h ? h + ":" : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export default function VideoPlayer({
    type, id, tmdbData, season: cSeason, episode: cEpisode, onSeasonChange, onEpisodeChange,
}: VideoPlayerProps) {
    const [iSeason, setISeason] = useState(1);
    const [iEpisode, setIEpisode] = useState(1);
    const controlled = cSeason !== undefined && cEpisode !== undefined;
    const season = controlled ? cSeason! : iSeason;
    const episode = controlled ? cEpisode! : iEpisode;

    const wrapRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTap = useRef<{ t: number; x: number }>({ t: 0, x: 0 });
    const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const gesture = useRef<{ x: number; y: number; mode: "none" | "seek" | "vol" | "bright"; start: number; base: number } | null>(null);
    const pendingSeek = useRef<number | null>(null);

    const [sources, setSources] = useState<Source[] | null>(null);
    const [current, setCurrent] = useState<Source | null>(null);
    const [playing, setPlaying] = useState(false);
    const [waiting, setWaiting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const failedRef = useRef<Set<string>>(new Set());
    const [time, setTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [fit, setFit] = useState<Fit>("contain");
    const [brightness, setBrightness] = useState(1);
    const [locked, setLocked] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [showUI, setShowUI] = useState(true);
    const [menu, setMenu] = useState(false);
    const [hud, setHud] = useState<string | null>(null);
    const [ripple, setRipple] = useState<"l" | "r" | null>(null);

    const title = tmdbData?.title || tmdbData?.name || "";
    const resumeKey = `mb-resume-${type}-${id}${type === "tv" ? `-${season}-${episode}` : ""}`;
    const poster = tmdbData?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbData.backdrop_path}` : undefined;
    // Ads are OFF unless the owner explicitly enables them.
    const adsEnabled = siteConfig.enablePlayerAds;

    // ---- load sources ----
    useEffect(() => {
        let cancel = false;
        setSources(null); setCurrent(null); setError(null); failedRef.current = new Set();
        const qs = new URLSearchParams({ title, type });
        if (type === "tv") { qs.set("season", String(season)); qs.set("episode", String(episode)); }
        fetch(`/api/movies/sources?${qs}`)
            .then((r) => r.json())
            .then((d: { sources?: Source[] }) => {
                if (cancel) return;
                const list = d.sources ?? [];
                setSources(list);
                let pref: string | null = null;
                try { pref = localStorage.getItem(LANG_KEY); } catch { /* ignore */ }
                setCurrent(list.find((s) => s.language === pref) ?? list[0] ?? null);
            })
            .catch(() => { if (!cancel) setSources([]); });
        return () => { cancel = true; };
    }, [title, type, season, episode]);

    // ---- recently played ----
    useEffect(() => {
        if (!tmdbData) return;
        saveToRecentlyPlayed({
            id, type, title, overview: tmdbData.overview, poster_path: tmdbData.poster_path,
            backdrop_path: tmdbData.backdrop_path, vote_average: tmdbData.vote_average,
            release_date: tmdbData.release_date, first_air_date: tmdbData.first_air_date,
            last_played: Date.now(), season: type === "tv" ? season : undefined,
            episode: type === "tv" ? episode : undefined, tagline: tmdbData.tagline,
        });
    }, [id, type, season, episode, tmdbData, title]);

    // ---- UI auto-hide ----
    const poke = useCallback(() => {
        setShowUI(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
            if (videoRef.current && !videoRef.current.paused) { setShowUI(false); setMenu(false); }
        }, 3000);
    }, []);

    const flash = useCallback((t: string) => {
        setHud(t);
        setTimeout(() => setHud((h) => (h === t ? null : h)), 800);
    }, []);

    // ---- actions ----
    const toggle = useCallback(() => {
        const v = videoRef.current; if (!v) return;
        if (v.paused) v.play().catch(() => setError("Tap play to start")); else v.pause();
        poke();
    }, [poke]);
    const seekBy = useCallback((d: number) => {
        const v = videoRef.current; if (!v) return;
        v.currentTime = Math.max(0, Math.min((v.duration || 0), v.currentTime + d));
        flash(`${d > 0 ? "+" : ""}${d}s`); poke();
    }, [flash, poke]);
    const setVol = useCallback((n: number) => {
        const v = videoRef.current; if (!v) return;
        const x = Math.max(0, Math.min(1, n));
        v.volume = x; v.muted = x === 0; setVolume(x); setMuted(x === 0);
        flash(`Volume ${Math.round(x * 100)}%`);
    }, [flash]);
    const toggleFs = useCallback(async () => {
        const el = wrapRef.current; if (!el) return;
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else {
                await el.requestFullscreen();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                try { await (screen.orientation as any)?.lock?.("landscape"); } catch { /* unsupported */ }
            }
        } catch { /* ignore */ }
    }, []);
    const pick = useCallback((s: Source) => {
        const v = videoRef.current;
        pendingSeek.current = v ? v.currentTime : null;
        setCurrent(s); setError(null);
        try { localStorage.setItem(LANG_KEY, s.language); } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        const f = () => setFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", f);
        return () => document.removeEventListener("fullscreenchange", f);
    }, []);

    // ---- keyboard (PC / TV remote) ----
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || !current) return;
            const k = e.key.toLowerCase();
            if (k === "l") { setLocked((x) => !x); return; }
            if (locked) return;
            if (k === " " || k === "k" || k === "enter" || k === "mediaplaypause") { e.preventDefault(); toggle(); }
            else if (k === "arrowright") { e.preventDefault(); seekBy(10); }
            else if (k === "arrowleft") { e.preventDefault(); seekBy(-10); }
            else if (k === "arrowup") { e.preventDefault(); setVol(volume + 0.1); }
            else if (k === "arrowdown") { e.preventDefault(); setVol(volume - 0.1); }
            else if (k === "m") { const v = videoRef.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }
            else if (k === "f") toggleFs();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [current, locked, toggle, seekBy, setVol, toggleFs, volume]);

    // ---- touch gestures ----
    const onPointerDown = (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") return;
        const v = videoRef.current; if (!v) return;
        gesture.current = { x: e.clientX, y: e.clientY, mode: "none", start: v.currentTime, base: 0 };
    };
    const onPointerMove = (e: React.PointerEvent) => {
        const g = gesture.current; const v = videoRef.current; const el = wrapRef.current;
        if (!g || !v || !el || locked) return;
        const dx = e.clientX - g.x, dy = e.clientY - g.y;
        const rect = el.getBoundingClientRect();
        if (g.mode === "none") {
            if (Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy)) g.mode = "seek";
            else if (Math.abs(dy) > 20) {
                g.mode = e.clientX - rect.left < rect.width / 2 ? "bright" : "vol";
                g.base = g.mode === "vol" ? v.volume : brightness;
            } else return;
        }
        if (g.mode === "seek") {
            const t = Math.max(0, Math.min(v.duration || 0, g.start + (dx / rect.width) * 120));
            setHud(`${fmt(t)} / ${fmt(v.duration)}`);
            pendingSeek.current = t;
        } else if (g.mode === "vol") {
            setVol(g.base - dy / rect.height);
        } else {
            const b = Math.max(0.2, Math.min(1.5, g.base - dy / rect.height));
            setBrightness(b); setHud(`Brightness ${Math.round(b * 100)}%`);
        }
    };
    const moved = useRef(false);
    const onPointerUp = () => {
        const g = gesture.current; const v = videoRef.current;
        if (g?.mode === "seek" && v && pendingSeek.current != null) { v.currentTime = pendingSeek.current; pendingSeek.current = null; }
        moved.current = !!g && g.mode !== "none";
        if (moved.current) setTimeout(() => setHud(null), 500);
        gesture.current = null;
    };

    const onSurfaceClick = (e: React.MouseEvent) => {
        if (moved.current) { moved.current = false; return; }
        if (locked) { poke(); return; }
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const isTouch = (e.nativeEvent as PointerEvent).pointerType === "touch";
        const now = Date.now();
        if (now - lastTap.current.t < 300) {
            if (tapTimer.current) clearTimeout(tapTimer.current);
            lastTap.current.t = 0;
            if (x < rect.width / 3) { seekBy(-10); setRipple("l"); }
            else if (x > (rect.width * 2) / 3) { seekBy(10); setRipple("r"); }
            else toggleFs();
            setTimeout(() => setRipple(null), 450);
            return;
        }
        lastTap.current = { t: now, x };
        tapTimer.current = setTimeout(() => {
            if (!isTouch) toggle();
            else if (showUI) { setShowUI(false); setMenu(false); }
            else poke();
        }, 260);
    };

    const seasons = (tmdbData?.seasons as Array<{ season_number: number; name?: string; episode_count: number }>) || [];
    const setSeason = (s: number) => { if (!controlled) { setISeason(s); setIEpisode(1); } onSeasonChange?.(s); };
    const setEpisode = (e: number) => { if (!controlled) setIEpisode(e); onEpisodeChange?.(e); };

    const languages = Array.from(new Set((sources ?? []).map((s) => s.language)));
    const qualities = (sources ?? []).filter((s) => s.language === current?.language);

    return (
        <div className="w-full bg-black">
            <div
                ref={wrapRef}
                className="relative w-full aspect-video max-h-[85vh] bg-black overflow-hidden select-none touch-none"
                onMouseMove={poke}
                style={{ cursor: showUI ? "default" : "none" }}
            >
                {sources === null ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-accent" />
                    </div>
                ) : !current ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                        {poster && <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: `url(${poster})` }} />}
                        <Film className="relative w-12 h-12 text-accent" />
                        <h3 className="relative text-xl font-black text-white">Stream updating soon</h3>
                        <p className="relative text-sm text-gray-400 max-w-md">
                            This title&apos;s ad-free direct stream is still being added to our library. Please check back shortly.
                        </p>
                    </div>
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            key={current.url}
                            src={current.url}
                            poster={poster}
                            playsInline
                            autoPlay
                            preload="metadata"
                            className="absolute inset-0 w-full h-full"
                            style={{ objectFit: fit, filter: `brightness(${brightness})` }}
                            onLoadedMetadata={(e) => {
                                const v = e.currentTarget;
                                v.playbackRate = speed; v.volume = volume; v.muted = muted;
                                setDuration(v.duration);
                                let t = pendingSeek.current;
                                if (t == null) { try { t = Number(localStorage.getItem(resumeKey)) || null; } catch { t = null; } }
                                if (t && t < v.duration - 10) v.currentTime = t;
                                pendingSeek.current = null;
                            }}
                            onTimeUpdate={(e) => {
                                const v = e.currentTarget;
                                setTime(v.currentTime);
                                if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
                                if (Math.floor(v.currentTime) % 5 === 0) {
                                    try { localStorage.setItem(resumeKey, String(Math.floor(v.currentTime))); } catch { /* ignore */ }
                                }
                            }}
                            onPlay={() => { setPlaying(true); poke(); }}
                            onPause={() => { setPlaying(false); setShowUI(true); }}
                            onWaiting={() => setWaiting(true)}
                            onPlaying={() => { setWaiting(false); setError(null); }}
                            onCanPlay={() => setWaiting(false)}
                            onEnded={() => { try { localStorage.removeItem(resumeKey); } catch { /* ignore */ } }}
                            onError={() => {
                                failedRef.current.add(current.id);
                                const next = (sources ?? []).find((s) => !failedRef.current.has(s.id));
                                if (next) pick(next); else setError("This movie is not ready to stream yet. Please try again later.");
                            }}
                        />

                        {/* gesture / tap surface */}
                        <div
                            className="absolute inset-0"
                            onClick={onSurfaceClick}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={onPointerUp}
                        />

                        {ripple && (
                            <div className={`pointer-events-none absolute top-0 bottom-0 w-1/3 flex items-center justify-center bg-white/10 animate-pulse ${ripple === "l" ? "left-0 rounded-r-full" : "right-0 rounded-l-full"}`}>
                                {ripple === "l" ? <RotateCcw className="w-10 h-10 text-white" /> : <RotateCw className="w-10 h-10 text-white" />}
                            </div>
                        )}
                        {(waiting || hud || error) && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                {error ? (
                                    <div className="rounded-xl bg-black/80 px-5 py-3 text-sm font-bold text-white">{error}</div>
                                ) : hud ? (
                                    <div className="flex items-center gap-2 rounded-xl bg-black/70 px-5 py-3 text-lg font-black text-white">
                                        {hud.startsWith("Brightness") && <Sun className="w-5 h-5" />}{hud}
                                    </div>
                                ) : <Loader2 className="w-12 h-12 animate-spin text-white" />}
                            </div>
                        )}

                        {/* lock button always reachable */}
                        {(showUI || locked) && (
                            <button
                                aria-label={locked ? "Unlock screen" : "Lock screen"}
                                onClick={() => { setLocked((x) => !x); poke(); }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/60 p-3 text-white"
                            >
                                {locked ? <Lock className="w-5 h-5 text-accent" /> : <Unlock className="w-5 h-5" />}
                            </button>
                        )}

                        {!locked && (
                            <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${showUI ? "opacity-100" : "opacity-0"}`}>
                                <div className="absolute top-0 inset-x-0 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent p-4 pointer-events-auto">
                                    {fullscreen && (
                                        <button aria-label="Exit fullscreen" onClick={toggleFs} className="text-white"><ChevronLeft className="w-6 h-6" /></button>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm md:text-base font-black text-white">{title}{type === "tv" ? ` · S${season} E${episode}` : ""}</div>
                                        <div className="text-[11px] font-bold text-accent">{current.label}{adsEnabled ? "" : " · Ad-free"}</div>
                                    </div>
                                </div>

                                {!playing && !waiting && (
                                    <button aria-label="Play" onClick={toggle} className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent p-5 text-black shadow-2xl">
                                        <Play className="w-8 h-8 fill-current" />
                                    </button>
                                )}

                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-10 pointer-events-auto">
                                    <div className="relative h-1.5 w-full rounded-full bg-white/20 mb-3 group">
                                        <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
                                        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
                                        <input
                                            type="range" min={0} max={duration || 0} step={0.1} value={time}
                                            aria-label="Seek"
                                            onChange={(e) => { const v = videoRef.current; if (v) v.currentTime = Number(e.target.value); poke(); }}
                                            className="absolute -inset-y-2 inset-x-0 w-full opacity-0 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3 text-white">
                                        <button aria-label={playing ? "Pause" : "Play"} onClick={toggle}>{playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}</button>
                                        <button aria-label="Back 10 seconds" onClick={() => seekBy(-10)}><RotateCcw className="w-5 h-5" /></button>
                                        <button aria-label="Forward 10 seconds" onClick={() => seekBy(10)}><RotateCw className="w-5 h-5" /></button>
                                        <button aria-label={muted ? "Unmute" : "Mute"} onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }}>
                                            {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                        </button>
                                        <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} aria-label="Volume"
                                            onChange={(e) => setVol(Number(e.target.value))} className="hidden md:block w-24 accent-accent" />
                                        <span className="text-xs font-bold tabular-nums">{fmt(time)} / {fmt(duration)}</span>
                                        <div className="flex-1" />
                                        <button aria-label="Settings" onClick={() => setMenu((m) => !m)}><Settings className={`w-5 h-5 ${menu ? "text-accent" : ""}`} /></button>
                                        <button aria-label="Fullscreen" onClick={toggleFs}>{fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}</button>
                                    </div>
                                </div>

                                {menu && (
                                    <div className="pointer-events-auto absolute right-4 bottom-20 z-30 w-64 max-h-[60%] overflow-y-auto rounded-xl bg-black/90 p-3 text-white text-sm space-y-3 border border-white/10">
                                        {languages.length > 1 && (
                                            <MenuGroup label="Audio">
                                                {languages.map((l) => (
                                                    <Chip key={l} active={current.language === l} onClick={() => pick((sources ?? []).find((s) => s.language === l && s.quality === current.quality) ?? (sources ?? []).find((s) => s.language === l)!)}>{l}</Chip>
                                                ))}
                                            </MenuGroup>
                                        )}
                                        <MenuGroup label="Quality">
                                            {qualities.map((s) => (
                                                <Chip key={s.id} active={current.id === s.id} onClick={() => pick(s)}>{s.quality}</Chip>
                                            ))}
                                        </MenuGroup>
                                        <MenuGroup label="Speed">
                                            {SPEEDS.map((s) => (
                                                <Chip key={s} active={speed === s} onClick={() => { setSpeed(s); if (videoRef.current) videoRef.current.playbackRate = s; }}>{s === 1 ? "Normal" : `${s}x`}</Chip>
                                            ))}
                                        </MenuGroup>
                                        <MenuGroup label="Aspect">
                                            {FITS.map((f) => (
                                                <Chip key={f.v} active={fit === f.v} onClick={() => setFit(f.v)}>{f.l}</Chip>
                                            ))}
                                        </MenuGroup>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {type === "tv" && seasons.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[#0d141c]">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Season</span>
                    <Dropdown
                        value={season}
                        onChange={(val) => setSeason(Number(val))}
                        options={seasons.map((s) => ({ value: s.season_number, label: s.name || `Season ${s.season_number}` }))}
                        className="px-3 py-1.5 rounded-lg text-xs bg-[#1a242f] border-none shadow-none font-bold"
                        menuClassName="min-w-[140px] bottom-full mb-2 mt-0 top-auto origin-bottom-left"
                    />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Episode</span>
                    <Dropdown
                        value={episode}
                        onChange={(val) => setEpisode(Number(val))}
                        options={Array.from(
                            { length: seasons.find((s) => s.season_number === season)?.episode_count || 50 },
                            (_, i) => ({ value: i + 1, label: `Episode ${i + 1}` }),
                        )}
                        className="px-3 py-1.5 rounded-lg text-xs bg-[#1a242f] border-none shadow-none font-bold"
                        menuClassName="min-w-[140px] bottom-full mb-2 mt-0 top-auto origin-bottom-left"
                    />
                </div>
            )}
        </div>
    );
}

function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</div>
            <div className="flex flex-wrap gap-1.5">{children}</div>
        </div>
    );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button onClick={onClick} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${active ? "bg-accent text-black" : "bg-white/10 text-white hover:bg-white/20"}`}>
            {children}
        </button>
    );
}
