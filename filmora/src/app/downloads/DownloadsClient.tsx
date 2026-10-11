"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    Download,
    Trash2,
    RotateCw,
    Film,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    Play,
    WifiOff,
    Smartphone,
    FolderOpen,
} from "lucide-react";
import {
    DownloadItem,
    DOWNLOADS_EVENT,
    clearDownloads,
    formatBytes,
    getDownloads,
    removeDownload,
    startDownload,
} from "@/lib/downloads";
import { OFFLINE_EVENT, deleteOffline, listOfflineIds, offlineUsage } from "@/lib/offline";
import OfflinePlayer from "@/components/OfflinePlayer";
import { TMDB_CONFIG } from "@/lib/tmdb";
import { DEVICE_FOLDER, isAndroidApp, nativeOpen, nativeToast } from "@/lib/native";


function StatusBadge({ item }: { item: DownloadItem }) {
    if (item.status === "downloading" || item.status === "queued")
        return (
            <span className="flex items-center gap-1.5 text-xs font-bold text-accent">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Downloading
            </span>
        );
    if (item.status === "completed")
        return (
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
        );
    if (item.status === "device")
        return (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <Smartphone className="w-3.5 h-3.5" /> Saved in {DEVICE_FOLDER}
            </span>
        );
    if (item.status === "opened")
        return (
            <span className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                <Download className="w-3.5 h-3.5" /> Saving in browser
            </span>
        );
    return (
        <span className="flex items-center gap-1.5 text-xs font-bold text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" /> Failed
        </span>
    );
}

export default function DownloadsClient() {
    const [items, setItems] = useState<DownloadItem[]>([]);
    const [ready, setReady] = useState(false);
    const [offlineIds, setOfflineIds] = useState<string[]>([]);
    const [space, setSpace] = useState<{ usage: number; quota: number } | null>(null);
    const [playing, setPlaying] = useState<DownloadItem | null>(null);
    const [localPlayerOpen, setLocalPlayerOpen] = useState(false);

    const syncOffline = useCallback(() => {
        listOfflineIds().then(setOfflineIds);
        offlineUsage().then(setSpace);
    }, []);

    useEffect(() => {
        const sync = () => setItems(getDownloads());
        sync();
        syncOffline();
        setReady(true);
        window.addEventListener(DOWNLOADS_EVENT, sync);
        window.addEventListener(OFFLINE_EVENT, syncOffline);
        window.addEventListener("storage", sync);
        return () => {
            window.removeEventListener(DOWNLOADS_EVENT, sync);
            window.removeEventListener(OFFLINE_EVENT, syncOffline);
            window.removeEventListener("storage", sync);
        };
    }, [syncOffline]);

    const handleRemove = (id: string) => {
        removeDownload(id);
        void deleteOffline(id);
    };

    const handleClearAll = () => {
        for (const item of items) void deleteOffline(item.id);
        clearDownloads();
    };


    return (
        <main className="downloads-library container mx-auto px-4 md:px-8 pt-24 pb-28 min-h-screen">
            <header className="downloads-hero flex items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white flex items-center gap-3">
                        <Download className="w-8 h-8 text-accent" /> My Downloads
                    </h1>
                    <p className="text-sm text-gray-400 mt-2">
                        Saved on this device — tap Play to watch without internet.
                        {isAndroidApp() ? ` App downloads go to ${DEVICE_FOLDER} on your phone.` : ""}
                    </p>
                    {space && space.quota > 0 && (
                        <p className="text-[11px] text-gray-500 mt-1">
                            Offline storage used: {formatBytes(space.usage)} of {formatBytes(space.quota)}
                        </p>
                    )}
                </div>
                <div className="downloads-hero-actions flex shrink-0 flex-wrap items-center gap-2">
                    <button
                        onClick={() => {
                            setPlaying(null);
                            setLocalPlayerOpen(true);
                        }}
                        className="downloads-local-open flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-black text-accent transition hover:border-accent/60 hover:bg-accent/15"
                    >
                        <FolderOpen className="h-4 w-4" />
                        <span>Play from device</span>
                    </button>
                    {items.length > 0 && (
                        <button
                            onClick={handleClearAll}
                            className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-400 transition-colors hover:text-red-400"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            </header>


            {ready && items.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-24 rounded-3xl border border-white/10 bg-white/5">
                    <Film className="w-14 h-14 text-gray-600 mb-4" />
                    <h2 className="text-xl font-bold text-white">No downloads yet</h2>
                    <p className="text-sm text-gray-400 mt-2 max-w-sm">
                        Open any movie or show and tap the Download button to save it here.
                    </p>
                    <Link href="/" className="mt-6 px-6 py-3 rounded-2xl bg-accent text-black font-black">
                        Browse movies
                    </Link>
                </div>
            )}

            <ul className="downloads-list space-y-3">
                {items.map((item) => {
                    const pct = item.size && item.received ? Math.min(100, Math.round((item.received / item.size) * 100)) : null;
                    const isOffline = offlineIds.includes(item.id);
                    return (
                        <li
                            key={item.id}
                            className="download-row flex gap-4 items-center rounded-2xl border border-white/10 bg-prime-card/60 p-3"
                        >
                            <button
                                onClick={() => (isOffline || item.device) && setPlaying(item)}
                                disabled={!isOffline && !item.device}
                                aria-label={isOffline ? `Play ${item.title} offline` : item.title}
                                className="relative w-14 h-20 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 group"
                            >
                                {item.poster_path ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={`${TMDB_CONFIG.imageBase}/w200${item.poster_path}`}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Film className="w-6 h-6 text-gray-600" />
                                    </div>
                                )}
                                {isOffline && (
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/60 transition-colors">
                                        <Play className="w-5 h-5 text-white" />
                                    </span>
                                )}
                            </button>

                            <div className="flex-1 min-w-0">
                                {isOffline ? (
                                    <button
                                        onClick={() => setPlaying(item)}
                                        className="block w-full text-left text-white font-bold truncate hover:text-accent transition-colors"
                                    >
                                        {item.title}
                                    </button>
                                ) : (
                                    <Link
                                        href={`/watch/${item.type}/${item.tmdbId}`}
                                        className="block text-white font-bold truncate hover:text-accent transition-colors"
                                    >
                                        {item.title}
                                    </Link>
                                )}
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {item.quality} • {formatBytes(item.size ?? item.received ?? 0)}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                    <StatusBadge item={item} />
                                    {pct !== null && item.status === "downloading" && (
                                        <span className="text-xs text-gray-400">{pct}%</span>
                                    )}
                                    {isOffline && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                                            <WifiOff className="w-3.5 h-3.5" /> Available offline
                                        </span>
                                    )}
                                </div>
                                {item.error && item.status !== "downloading" && (
                                    <p className="mt-1 text-[11px] text-yellow-300/80 line-clamp-2">{item.error}</p>
                                )}
                                {item.status === "downloading" && (
                                    <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                                        <div
                                            className="h-full bg-accent transition-all"
                                            style={{ width: `${pct ?? 5}%` }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                {item.device && (
                                    <button
                                        onClick={() => {
                                            if (!nativeOpen(item.fileName)) {
                                                nativeToast(`Open ${DEVICE_FOLDER} in your file manager`);
                                            }
                                        }}
                                        aria-label="Open file on phone"
                                        className="p-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400"
                                    >
                                        <FolderOpen className="w-4 h-4" />
                                    </button>
                                )}
                                {isOffline && (
                                    <button
                                        onClick={() => setPlaying(item)}
                                        aria-label="Play offline"
                                        className="p-2 rounded-xl bg-accent/20 hover:bg-accent/30 text-accent"
                                    >
                                        <Play className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => startDownload({ ...item, status: "queued", received: 0 })}
                                    aria-label="Download again"
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300"
                                >
                                    <RotateCw className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleRemove(item.id)}
                                    aria-label="Remove"
                                    className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-400"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            <OfflinePlayer
                open={playing !== null || localPlayerOpen}
                onClose={() => {
                    setPlaying(null);
                    setLocalPlayerOpen(false);
                }}
                id={playing?.id ?? "device-local"}
                title={playing?.title ?? "Choose a video from your device"}
                fileName={playing?.fileName}
                device={playing?.device}
            />
        </main>
    );
}
