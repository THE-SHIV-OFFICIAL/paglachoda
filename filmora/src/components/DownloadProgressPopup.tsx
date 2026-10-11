"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Download, Smartphone, X, Loader2, AlertTriangle } from "lucide-react";
import {
    DOWNLOADS_EVENT,
    DOWNLOAD_POPUP_EVENT,
    DownloadItem,
    formatBytes,
    getDownloads,
} from "@/lib/downloads";
import { DEVICE_FOLDER } from "@/lib/native";

/**
 * Floating download popup. Appears the moment a download starts (movie or APK)
 * and shows live progress, where the file is being saved, and a shortcut to
 * My Downloads for offline playback.
 */
export default function DownloadProgressPopup() {
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<DownloadItem[]>([]);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        const sync = () => setItems(getDownloads().slice(0, 4));
        const show = () => {
            sync();
            setOpen(true);
        };
        sync();
        window.addEventListener(DOWNLOADS_EVENT, sync);
        window.addEventListener(DOWNLOAD_POPUP_EVENT, show);
        return () => {
            window.removeEventListener(DOWNLOADS_EVENT, sync);
            window.removeEventListener(DOWNLOAD_POPUP_EVENT, show);
        };
    }, []);

    const active = useMemo(
        () => items.filter((i) => i.status === "downloading" || i.status === "queued"),
        [items],
    );

    // Auto-hide a few seconds after everything settles.
    useEffect(() => {
        if (!open || active.length > 0) return;
        const t = setTimeout(() => setOpen(false), 6000);
        return () => clearTimeout(t);
    }, [open, active.length, items]);

    if (!mounted || !open || items.length === 0) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 30, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="fixed bottom-24 right-3 z-[120] w-[min(22rem,calc(100vw-1.5rem))] sm:bottom-6 sm:right-6"
            >
                <div className="mb-glow-ring shine-sweep overflow-hidden rounded-3xl border border-white/10 bg-black/85 p-4 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 text-sm font-black text-white">
                            <Download className="h-4 w-4 text-accent" />
                            {active.length > 0 ? "Downloading" : "Downloads"}
                        </p>
                        <button
                            onClick={() => setOpen(false)}
                            aria-label="Close download popup"
                            className="rounded-full p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <ul className="mt-3 space-y-3">
                        {items.map((item) => {
                            const pct =
                                item.size && item.received
                                    ? Math.min(99, Math.round((item.received / item.size) * 100))
                                    : null;
                            return (
                                <li key={item.id} className="rounded-2xl border border-white/5 bg-white/[0.04] p-3">
                                    <p className="truncate text-xs font-bold text-white">{item.title}</p>
                                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-400">
                                        {item.status === "downloading" || item.status === "queued" ? (
                                            <>
                                                <Loader2 className="h-3 w-3 animate-spin text-accent" />
                                                {pct !== null ? `${pct}%` : formatBytes(item.received ?? 0)} · {item.quality}
                                            </>
                                        ) : item.status === "device" ? (
                                            <>
                                                <Smartphone className="h-3 w-3 text-emerald-300" />
                                                Saving to your phone · {DEVICE_FOLDER}
                                            </>
                                        ) : item.status === "failed" ? (
                                            <>
                                                <AlertTriangle className="h-3 w-3 text-red-400" />
                                                {item.error ?? "Failed"}
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                                                Saved on this device
                                            </>
                                        )}
                                    </p>
                                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-accent to-amber-200 transition-all"
                                            style={{
                                                width:
                                                    item.status === "downloading" || item.status === "queued"
                                                        ? `${pct ?? 8}%`
                                                        : "100%",
                                            }}
                                        />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    <Link
                        href="/downloads"
                        onClick={() => setOpen(false)}
                        className="mt-3 block rounded-2xl bg-accent px-4 py-2.5 text-center text-xs font-black text-black transition hover:brightness-110"
                    >
                        Open My Downloads
                    </Link>
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body,
    );
}
