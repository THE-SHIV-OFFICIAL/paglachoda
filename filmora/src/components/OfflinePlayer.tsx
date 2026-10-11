"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Loader2,
    WifiOff,
    RotateCcw,
    RotateCw,
    Gauge,
    Languages,
    Maximize,
    FolderOpen,
} from "lucide-react";
import { siteConfig } from "@/lib/config";
import { getOffline } from "@/lib/offline";
import { DEVICE_FOLDER, nativeOpen, nativeToast } from "@/lib/native";

interface OfflinePlayerProps {
    open: boolean;
    onClose: () => void;
    id: string;
    title: string;
    /** file name inside Download/MovieBox when Android saved it to the phone */
    fileName?: string;
    device?: boolean;
}

interface AudioTrackLike {
    id?: string;
    label?: string;
    language?: string;
    enabled: boolean;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const POSITION_PREFIX = "mb_offline_pos_";

function isHindi(track: AudioTrackLike) {
    const hay = `${track.language ?? ""} ${track.label ?? ""}`.toLowerCase();
    return /\b(hi|hin|hindi|urdu|dual)\b/.test(hay);
}

function isEnglish(track: AudioTrackLike) {
    const hay = `${track.language ?? ""} ${track.label ?? ""}`.toLowerCase();
    return /\b(en|eng|english)\b/.test(hay);
}

/**
 * Plays a movie straight from the phone — no internet needed.
 * Behaves like MX Player / VLC: resume where you left off, ±10s seek,
 * speed control and audio-track switching (Hindi picked automatically).
 */
export default function OfflinePlayer({
    open,
    onClose,
    id,
    title,
    fileName,
    device,
}: OfflinePlayerProps) {
    const [mounted, setMounted] = useState(false);
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [speed, setSpeed] = useState(1);
    const [tracks, setTracks] = useState<AudioTrackLike[]>([]);
    const [activeTrack, setActiveTrack] = useState(0);
    const [playbackId, setPlaybackId] = useState(id);
    const objectUrl = useRef<string | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const filePicker = useRef<HTMLInputElement | null>(null);

    useEffect(() => setMounted(true), []);

    const revoke = useCallback(() => {
        if (objectUrl.current) {
            URL.revokeObjectURL(objectUrl.current);
            objectUrl.current = null;
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setError(null);
        setUrl(null);
        setTracks([]);
        setPlaybackId(id);
        getOffline(id)
            .then((rec) => {
                if (cancelled) return;
                if (!rec) {
                    setError(
                        device
                            ? `This file is saved on your phone in ${DEVICE_FOLDER}. Open it there, or in MX Player / VLC.`
                            : "This movie isn't saved for offline play. Download it again, or pick the file from your phone below."
                    );
                    return;
                }
                const created = URL.createObjectURL(rec.blob);
                objectUrl.current = created;
                setUrl(created);
            })
            .catch(() => !cancelled && setError("Could not read the saved file."));
        return () => {
            cancelled = true;
            revoke();
        };
    }, [open, id, device, revoke]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const v = videoRef.current;
            if (e.key === "Escape") onClose();
            if (!v) return;
            if (e.key === "ArrowRight") v.currentTime += 10;
            if (e.key === "ArrowLeft") v.currentTime -= 10;
            if (e.key === " ") {
                e.preventDefault();
                v.paused ? void v.play() : v.pause();
            }
        };
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    /** Resume position + Hindi, then English, then source-default audio. */
    const handleLoaded = () => {
        const v = videoRef.current;
        if (!v) return;
        try {
            const saved = Number(localStorage.getItem(POSITION_PREFIX + playbackId) || 0);
            if (saved > 5 && saved < v.duration - 10) v.currentTime = saved;
        } catch {
            /* ignore */
        }
        const list = (v as unknown as { audioTracks?: ArrayLike<AudioTrackLike> }).audioTracks;
        if (list && list.length > 1) {
            const arr = Array.from(list as ArrayLike<AudioTrackLike>);
            const hindi = arr.findIndex(isHindi);
            const english = arr.findIndex(isEnglish);
            const enabled = arr.findIndex((t) => t.enabled);
            const pick = hindi >= 0 ? hindi : english >= 0 ? english : enabled;
            arr.forEach((t, i) => (t.enabled = i === Math.max(0, pick)));
            setTracks(arr);
            setActiveTrack(Math.max(0, pick));
        }
        v.playbackRate = speed;
    };

    const saveProgress = () => {
        const v = videoRef.current;
        if (!v || !v.currentTime) return;
        try {
            localStorage.setItem(POSITION_PREFIX + playbackId, String(Math.floor(v.currentTime)));
        } catch {
            /* ignore */
        }
    };

    const pickTrack = (index: number) => {
        tracks.forEach((t, i) => (t.enabled = i === index));
        setActiveTrack(index);
    };

    const cycleSpeed = () => {
        const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
        setSpeed(next);
        if (videoRef.current) videoRef.current.playbackRate = next;
    };

    const seek = (delta: number) => {
        if (videoRef.current) videoRef.current.currentTime += delta;
    };

    const goFullscreen = () => {
        void videoRef.current?.requestFullscreen?.().catch(() => undefined);
    };

    const openLocalFile = (file?: File | null) => {
        if (!file) return;
        revoke();
        const created = URL.createObjectURL(file);
        objectUrl.current = created;
        setPlaybackId(`device-${file.name}-${file.size}-${file.lastModified}`);
        setError(null);
        setUrl(created);
    };

    if (!mounted || !open) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] flex flex-col bg-black"
            >
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                    <div className="min-w-0">
                        <p className="truncate font-bold text-white">{title || "Play a video from this device"}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                            <WifiOff className="h-3 w-3" /> Offline player · Hindi audio preferred
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            onClick={() => filePicker.current?.click()}
                            aria-label="Choose a video from this device"
                            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:border-accent/50 hover:bg-white/10"
                        >
                            <FolderOpen className="h-4 w-4 text-accent" />
                            <span className="hidden sm:inline">Open video</span>
                        </button>
                        <button
                            onClick={() => {
                                saveProgress();
                                onClose();
                            }}
                            aria-label="Close player"
                            className="rounded-full p-2 text-gray-300 hover:bg-white/10"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="relative flex flex-1 items-center justify-center">
                    {!url && !error && (
                        <span className="flex items-center gap-3 text-gray-300">
                            <Loader2 className="h-5 w-5 animate-spin text-accent" /> Loading your movie…
                        </span>
                    )}

                    {error && (
                        <div className="max-w-sm px-6 text-center">
                            <p className="text-sm text-yellow-200">{error}</p>
                            <div className="mt-5 flex flex-col gap-2">
                                {fileName && (
                                    <button
                                        onClick={() => {
                                            if (!nativeOpen(fileName)) {
                                                nativeToast(`Open ${DEVICE_FOLDER} in your file manager`);
                                            }
                                        }}
                                        className="mb-glow-hover rounded-2xl bg-accent px-5 py-3 text-sm font-black text-black"
                                    >
                                        Open file on my phone
                                    </button>
                                )}
                                <button
                                    onClick={() => filePicker.current?.click()}
                                    className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
                                >
                                    <FolderOpen className="h-4 w-4" /> Pick a video from this device
                                </button>
                            </div>
                        </div>
                    )}

                    {url && (
                        <>
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            <video
                                ref={videoRef}
                                src={url}
                                controls
                                autoPlay
                                playsInline
                                controlsList="nodownload"
                                onLoadedMetadata={handleLoaded}
                                onTimeUpdate={saveProgress}
                                onPause={saveProgress}
                                className="h-full max-h-full w-full bg-black"
                            />
                            <span className="pointer-events-none absolute right-3 top-3 z-[5] select-none text-[10px] font-black tracking-wider text-white/25 drop-shadow sm:text-xs">
                                {siteConfig.brandBy || siteConfig.name}
                            </span>
                        </>
                    )}

                    <input
                        ref={filePicker}
                        type="file"
                        accept="video/*,.mkv,.mp4,.avi"
                        className="hidden"
                        onChange={(e) => {
                            openLocalFile(e.target.files?.[0]);
                            e.currentTarget.value = "";
                        }}
                    />
                </div>

                {url && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
                        <button
                            onClick={() => seek(-10)}
                            className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-white/10"
                        >
                            <RotateCcw className="h-3.5 w-3.5" /> 10s
                        </button>
                        <button
                            onClick={() => seek(10)}
                            className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-white/10"
                        >
                            <RotateCw className="h-3.5 w-3.5" /> 10s
                        </button>
                        <button
                            onClick={cycleSpeed}
                            className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-white/10"
                        >
                            <Gauge className="h-3.5 w-3.5" /> {speed}x
                        </button>
                        <button
                            onClick={goFullscreen}
                            className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-white/10"
                        >
                            <Maximize className="h-3.5 w-3.5" /> Fullscreen
                        </button>

                        {tracks.length > 1 && (
                            <div className="ml-auto flex items-center gap-2">
                                <Languages className="h-4 w-4 text-accent" />
                                {tracks.map((t, i) => (
                                    <button
                                        key={t.id ?? i}
                                        onClick={() => pickTrack(i)}
                                        className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                                            i === activeTrack
                                                ? "bg-accent text-black"
                                                : "bg-white/5 text-gray-300 hover:bg-white/10"
                                        }`}
                                    >
                                        {t.label || t.language?.toUpperCase() || `Audio ${i + 1}`}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
