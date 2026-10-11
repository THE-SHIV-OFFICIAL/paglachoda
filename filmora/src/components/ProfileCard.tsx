"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
    Bookmark,
    Camera,
    Check,
    Clapperboard,
    Clock,
    Download,
    Flame,
    Pencil,
    Smartphone,
    Trophy,
} from "lucide-react";
import HistorySettings from "./HistorySettings";
import { ACTIVITY_EVENT, formatDuration, localScore, readActivity } from "@/lib/activity";
import { getWatchlist } from "@/lib/storage";
import { getDownloads, DOWNLOADS_EVENT } from "@/lib/downloads";

/**
 * Device profile — no sign-in, no OTP, no password.
 * The name and photo live on this device only, so opening the app is instant.
 */

const LS_PREFIX = process.env.NEXT_PUBLIC_LS_PREFIX ?? "fw_";
const NAME_KEY = `${LS_PREFIX}profile_name`;
const PIC_KEY = `${LS_PREFIX}profile_pic`;
const SINCE_KEY = `${LS_PREFIX}profile_since`;
const MAX_IMAGE_BYTES = 280_000;

function fileToAvatar(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read that image."));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error("That file isn't a valid image."));
            img.onload = () => {
                const size = 256;
                const canvas = document.createElement("canvas");
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext("2d");
                if (!ctx) return reject(new Error("Could not process that image."));
                const side = Math.min(img.width, img.height);
                ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
                let quality = 0.85;
                let out = canvas.toDataURL("image/jpeg", quality);
                while (out.length > MAX_IMAGE_BYTES && quality > 0.4) {
                    quality -= 0.1;
                    out = canvas.toDataURL("image/jpeg", quality);
                }
                resolve(out);
            };
            img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    });
}

export default function ProfileCard() {
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [name, setName] = useState("Movie Fan");
    const [picture, setPicture] = useState<string | null>(null);
    const [since, setSince] = useState<number | null>(null);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const [stats, setStats] = useState({ watch: 0, play: 0, score: 0, days: 0 });
    const [counts, setCounts] = useState({ list: 0, downloads: 0 });

    const syncStats = useCallback(() => {
        const a = readActivity();
        setStats({ watch: a.seconds, play: a.playSeconds, score: localScore(a), days: a.days.length });
        setCounts({ list: getWatchlist().length, downloads: getDownloads().length });
    }, []);

    useEffect(() => {
        try {
            setName(localStorage.getItem(NAME_KEY) || "Movie Fan");
            setPicture(localStorage.getItem(PIC_KEY));
            const s = Number(localStorage.getItem(SINCE_KEY) || 0);
            if (s > 0) setSince(s);
            else {
                const now = Date.now();
                localStorage.setItem(SINCE_KEY, String(now));
                setSince(now);
            }
        } catch {
            /* ignore */
        }
        syncStats();
        window.addEventListener(ACTIVITY_EVENT, syncStats);
        window.addEventListener(DOWNLOADS_EVENT, syncStats);
        window.addEventListener("watchlistUpdated", syncStats);
        return () => {
            window.removeEventListener(ACTIVITY_EVENT, syncStats);
            window.removeEventListener(DOWNLOADS_EVENT, syncStats);
            window.removeEventListener("watchlistUpdated", syncStats);
        };
    }, [syncStats]);

    const saveName = () => {
        const clean = draft.trim().slice(0, 32) || "Movie Fan";
        setName(clean);
        try {
            localStorage.setItem(NAME_KEY, clean);
        } catch {
            /* ignore */
        }
        setEditing(false);
    };

    const pickPhoto = async (file?: File | null) => {
        if (!file) return;
        try {
            const data = await fileToAvatar(file);
            setPicture(data);
            localStorage.setItem(PIC_KEY, data);
        } catch {
            /* ignore */
        }
    };

    const tiles = [
        { icon: Trophy, label: "Fan score", value: stats.score.toLocaleString() },
        { icon: Clock, label: "Time on app", value: formatDuration(stats.watch) },
        { icon: Clapperboard, label: "Watch time", value: formatDuration(stats.play) },
        { icon: Flame, label: "Active days", value: String(stats.days) },
        { icon: Bookmark, label: "My list", value: String(counts.list) },
        { icon: Download, label: "Downloads", value: String(counts.downloads) },
    ];

    return (
        <main className="min-h-screen px-4 pb-28 pt-24 sm:px-6">
            <div className="mx-auto max-w-4xl space-y-6">
                <section className="mb-glow-ring shine-sweep rounded-[2rem] border border-white/10 bg-gradient-to-br from-black via-[var(--prime-card)] to-black p-7 sm:p-10">
                    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="mb-glow-soft group relative h-24 w-24 overflow-hidden rounded-3xl border border-white/15 bg-white/5"
                            aria-label="Change profile photo"
                        >
                            {picture ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={picture} alt="Profile photo" className="h-full w-full object-cover" />
                            ) : (
                                <span className="flex h-full w-full items-center justify-center text-3xl font-black text-accent">
                                    {name.slice(0, 1).toUpperCase()}
                                </span>
                            )}
                            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/60 py-1 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                                <Camera className="h-3 w-3" /> Change
                            </span>
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => pickPhoto(e.target.files?.[0])}
                        />

                        <div className="flex-1 text-center sm:text-left">
                            {editing ? (
                                <div className="flex items-center justify-center gap-2 sm:justify-start">
                                    <input
                                        value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                        placeholder="Your name"
                                        className="w-44 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm font-bold text-white outline-none focus:border-accent"
                                    />
                                    <button onClick={saveName} className="rounded-xl bg-accent p-2 text-black" aria-label="Save name">
                                        <Check className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <h1 className="flex items-center justify-center gap-2 text-3xl font-black text-white sm:justify-start sm:text-4xl">
                                    <span className="mb-gradient-text">{name}</span>
                                    <button
                                        onClick={() => {
                                            setDraft(name);
                                            setEditing(true);
                                        }}
                                        className="rounded-full p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
                                        aria-label="Edit name"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                </h1>
                            )}
                            <p className="mt-2 text-xs text-gray-400">
                                Profile stored on this device{since ? ` · since ${new Date(since).toLocaleDateString()}` : ""}
                            </p>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {tiles.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="mb-glow-hover rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                            <Icon className="h-5 w-5 text-accent" />
                            <p className="mt-3 text-2xl font-black text-white">{value}</p>
                            <p className="text-[11px] uppercase tracking-widest text-gray-500">{label}</p>
                        </div>
                    ))}
                </section>

                <section className="grid gap-3 sm:grid-cols-2">
                    <Link
                        href="/downloads"
                        className="mb-glow-hover flex items-center gap-4 rounded-3xl border border-white/10 bg-[var(--prime-card)]/70 p-5"
                    >
                        <Download className="h-6 w-6 text-accent" />
                        <span>
                            <span className="block text-sm font-black text-white">My downloads</span>
                            <span className="block text-xs text-gray-400">Play saved movies without internet</span>
                        </span>
                    </Link>
                    <Link
                        href="/app"
                        className="mb-glow-hover flex items-center gap-4 rounded-3xl border border-white/10 bg-[var(--prime-card)]/70 p-5"
                    >
                        <Smartphone className="h-6 w-6 text-accent" />
                        <span>
                            <span className="block text-sm font-black text-white">Android app</span>
                            <span className="block text-xs text-gray-400">Download the APK and save movies to your phone</span>
                        </span>
                    </Link>
                </section>

                <HistorySettings />
            </div>
        </main>
    );
}
