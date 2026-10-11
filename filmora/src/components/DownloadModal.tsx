"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Loader2, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import { siteConfig } from "@/lib/config";
import {
    DownloadItem,
    formatBytes,
    resolveSource,
    safeFileName,
    startDownload,
} from "@/lib/downloads";

interface DownloadModalProps {
    open: boolean;
    onClose: () => void;
    type: "movie" | "tv";
    tmdbId: string;
    title: string;
    poster_path?: string | null;
    season?: number;
    episode?: number;
}

const QUALITIES = [
    { key: "480p", label: "480p", note: "Data saver • smallest size", factor: 0.35 },
    { key: "720p", label: "720p HD", note: "Best balance • recommended", factor: 0.6 },
    { key: "1080p", label: "1080p Full HD", note: "Sharpest picture • biggest size", factor: 1 },
];

export default function DownloadModal({
    open,
    onClose,
    type,
    tmdbId,
    title,
    poster_path,
    season,
    episode,
}: DownloadModalProps) {
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [source, setSource] = useState<{ url: string; size?: number | null; quality?: string | null } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [files, setFiles] = useState<Array<{ id: string; url: string; quality: string; language: string; size?: number | null }>>([]);
    const [started, setStarted] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!open) {
            setStarted(false);
            setError(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        setFiles([]);
        const qs = new URLSearchParams({ title, type });
        if (type === "tv" && season && episode) { qs.set("season", String(season)); qs.set("episode", String(episode)); }
        fetch(`/api/movies/sources?${qs}`)
            .then((r) => (r.ok ? r.json() : { sources: [] }))
            .catch(() => ({ sources: [] }))
            .then((d) => { if (!cancelled) setFiles(d?.sources ?? []); });
        resolveSource(title, { type, season, episode })
            .then((src) => {
                if (cancelled) return;
                if (!src)
                    setError(
                        "We couldn't find a file for this title yet. Try again later or request it below."
                    );
                setSource(src);
            })
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [open, title, type, season, episode]);


    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const episodeSuffix = type === "tv" && season && episode ? ` S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}` : "";
    const fullTitle = `${title}${episodeSuffix}`;

    const handlePick = async (quality: string, picked?: { url: string; size?: number | null; language?: string }) => {
        const url = picked?.url ?? source?.url;
        if (!url) return;
        const fileName = safeFileName(fullTitle, quality);
        const item: DownloadItem = {
            id: `${type}-${tmdbId}-${season ?? 0}-${episode ?? 0}-${quality}${picked?.language ? `-${picked.language.replace(/\s+/g, "")}` : ""}`,
            tmdbId,
            type,
            title: fullTitle,
            poster_path: poster_path ?? null,
            quality,
            season,
            episode,
            url,
            fileName,
            size: picked ? picked.size ?? null : source?.size ?? null,
            received: 0,
            status: "queued",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        setStarted(true);
        startDownload(item);
        setTimeout(onClose, 900);
    };

    if (!mounted || !open) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-6"
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: 60, opacity: 0, scale: 0.98 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 40, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    className="w-full sm:max-w-md bg-prime-card/95 border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-start justify-between gap-4 mb-5">
                        <div>
                            <h3 className="text-xl font-black text-white flex items-center gap-2">
                                <Download className="w-5 h-5 text-accent" /> Download
                            </h3>
                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{fullTitle}</p>
                        </div>
                        <button onClick={onClose} aria-label="Close" className="p-2 rounded-full hover:bg-white/10 text-gray-300">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {loading && (
                        <div className="flex items-center gap-3 text-gray-300 py-8 justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-accent" />
                            Finding the best file…
                        </div>
                    )}

                    {!loading && error && !files.length && (
                        <div className="space-y-4">
                            <div className="flex items-start gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                            {siteConfig.botUsername && (
                                <a
                                    href={`https://t.me/${siteConfig.botUsername}?start=${encodeURIComponent(fullTitle)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-accent text-black font-black"
                                >
                                    <Send className="w-4 h-4" /> Request on Telegram
                                </a>
                            )}
                        </div>
                    )}

                    {!loading && files.length > 0 && (
                        <div className="space-y-3">
                            {files.map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => handlePick(f.quality, f)}
                                    disabled={started}
                                    className="w-full flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 hover:border-accent/60 hover:bg-white/10 disabled:opacity-50 transition-all px-4 py-3 text-left"
                                >
                                    <span>
                                        <span className="block text-white font-bold">{QUALITIES.find((q) => q.key === f.quality)?.label ?? f.quality}</span>
                                        <span className="block text-xs text-gray-400">{f.language}</span>
                                    </span>
                                    <span className="text-xs font-black text-accent whitespace-nowrap">{f.size ? formatBytes(f.size) : "Start"}</span>
                                </button>
                            ))}
                            {started && (
                                <div className="flex items-center gap-2 text-sm text-green-400">
                                    <CheckCircle2 className="w-4 h-4" /> Download started — check the Download tab.
                                </div>
                            )}
                        </div>
                    )}

                    {!loading && !error && source && !files.length && (
                        <div className="space-y-3">
                            {QUALITIES.map((q) => (
                                <button
                                    key={q.key}
                                    onClick={() => handlePick(q.key)}
                                    disabled={started}
                                    className="w-full flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 hover:border-accent/60 hover:bg-white/10 disabled:opacity-50 transition-all px-4 py-3 text-left"
                                >
                                    <span>
                                        <span className="block text-white font-bold">{q.label}</span>
                                        <span className="block text-xs text-gray-400">{q.note}</span>
                                    </span>
                                    <span className="text-xs font-black text-accent whitespace-nowrap">
                                        {source.size ? formatBytes(Math.round(source.size * q.factor)) : "Start"}
                                    </span>
                                </button>
                            ))}
                            {started && (
                                <p className="flex items-center gap-2 text-sm text-green-400 pt-1">
                                    <CheckCircle2 className="w-4 h-4" /> Download started — check the Download tab.
                                </p>
                            )}
                            <p className="text-[11px] text-gray-500 pt-1">
                                Large files can take a while. Keep the app open until it finishes —
                                the movie is also saved inside the app so you can watch it offline.
                            </p>

                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
