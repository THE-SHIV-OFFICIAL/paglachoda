"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    CheckCircle2,
    Download,
    FolderDown,
    PlayCircle,
    Shield,
    Smartphone,
    WifiOff,
    X,
} from "lucide-react";
import { siteConfig } from "@/lib/config";
import { startApkDownload } from "@/lib/downloads";
import { DEVICE_FOLDER, isAndroidApp } from "@/lib/native";

const FEATURES = [
    { icon: FolderDown, title: "Saves to your phone", text: `Every movie lands in ${DEVICE_FOLDER} on your own storage.` },
    { icon: WifiOff, title: "Watch offline", text: "Downloaded files play with no internet, inside the app or in MX Player / VLC." },
    { icon: PlayCircle, title: "Hindi-first player", text: "Hindi audio is picked automatically, with fullscreen and gesture controls." },
    { icon: Shield, title: "No sign-in needed", text: "Just open it — your profile, list and downloads stay on your device." },
];

export default function AppDownloadClient() {
    const [inApp, setInApp] = useState(false);
    const [started, setStarted] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => setInApp(isAndroidApp()), []);

    const handleDownload = async () => {
        setConfirmOpen(false);
        setStarted(true);
        await startApkDownload();
    };

    return (
        <main className="min-h-screen px-4 pb-28 pt-24 sm:px-6">
            <section className="mx-auto max-w-6xl">
                <div className="mb-glow-ring shine-sweep overflow-hidden rounded-[2.25rem] border border-white/10 bg-gradient-to-br from-black via-[var(--prime-card)] to-black">
                    <div className="grid gap-10 p-7 sm:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:p-14">
                        <div>
                            <span className="mb-pulse-glow inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-accent">
                                <Smartphone className="h-3.5 w-3.5" /> Android · APK
                            </span>
                            <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
                                <span className="mb-gradient-text">{siteConfig.name}</span>
                                <span className="block text-white">app for Android</span>
                            </h1>
                            <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-300">
                                Download movies, web series, K-Drama and short films directly into your
                                phone storage and play them offline — no player app required.
                            </p>

                            <div className="mt-8 flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => setConfirmOpen(true)}
                                    className="mb-glow-hover shine-sweep inline-flex items-center gap-2 rounded-2xl bg-accent px-6 py-3.5 text-sm font-black text-black"
                                >
                                    <Download className="h-4 w-4" />
                                    {started ? "Download started" : "Download APK"}
                                </button>
                                <a
                                    href={siteConfig.telegram}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-2xl border border-white/12 px-5 py-3.5 text-sm font-bold text-gray-300 transition hover:border-accent/50 hover:text-white"
                                >
                                    Latest build on Telegram
                                </a>
                                <Link
                                    href="/downloads"
                                    className="inline-flex items-center gap-2 rounded-2xl border border-white/12 px-5 py-3.5 text-sm font-bold text-gray-300 transition hover:border-accent/50 hover:text-white"
                                >
                                    My downloads
                                </Link>
                            </div>

                            <p className="mt-4 max-w-xl text-xs leading-relaxed text-gray-500">
                                {inApp
                                    ? `You are already using the app — the APK will be saved to ${DEVICE_FOLDER}, tap it to update.`
                                    : "After the file downloads, open it and allow “Install from unknown sources” once."}
                            </p>
                        </div>

                        <div className="grid gap-3 self-start sm:grid-cols-2">
                            {FEATURES.map(({ icon: Icon, title, text }) => (
                                <div
                                    key={title}
                                    className="mb-glow-hover rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                                >
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <p className="mt-4 text-sm font-black text-white">{title}</p>
                                    <p className="mt-1.5 text-xs leading-relaxed text-gray-400">{text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                    {[
                        { step: "1", title: "Download", text: "Tap Download APK — progress shows in the popup and in the notification bar." },
                        { step: "2", title: "Install", text: "Open the file from your Downloads folder and allow the one-time permission." },
                        { step: "3", title: "Enjoy", text: "Open MOVIE BOX, pick a title and hit download for offline watching." },
                    ].map((s) => (
                        <div key={s.step} className="rounded-3xl border border-white/10 bg-[var(--prime-card)]/70 p-6">
                            <span className="mb-glow-soft inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-sm font-black text-accent">
                                {s.step}
                            </span>
                            <p className="mt-4 flex items-center gap-2 text-sm font-black text-white">
                                <CheckCircle2 className="h-4 w-4 text-emerald-300" /> {s.title}
                            </p>
                            <p className="mt-1.5 text-xs leading-relaxed text-gray-400">{s.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            {confirmOpen && (
                <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="apk-download-title">
                    <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[var(--prime-card)] shadow-2xl">
                        <div className="flex items-start justify-between gap-4 p-6">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                                <Smartphone className="h-6 w-6" />
                            </div>
                            <button onClick={() => setConfirmOpen(false)} aria-label="Close" className="rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="px-6 pb-6">
                            <h2 id="apk-download-title" className="text-xl font-black text-white">Download MOVIE BOX?</h2>
                            <p className="mt-2 text-sm leading-relaxed text-gray-400">
                                The Android APK will download directly to your phone. Open the downloaded file and allow installation when Android asks.
                            </p>
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <button onClick={() => setConfirmOpen(false)} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-gray-300 transition hover:bg-white/5">Cancel</button>
                                <button onClick={handleDownload} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-black text-black transition hover:brightness-110">
                                    <Download className="h-4 w-4" /> Download APK
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
