"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Download, User, Film, Tv, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDownloads, DOWNLOADS_EVENT } from "@/lib/downloads";
import { isAndroidApp } from "@/lib/native";

const WEB_TABS = [
    { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
    { href: "/downloads", label: "Download", icon: Download, match: (p: string) => p.startsWith("/downloads") },
    { href: "/account", label: "Profile", icon: User, match: (p: string) => p.startsWith("/account") || p.startsWith("/login") },
];

const APP_TABS = [
    { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
    { href: "/movies", label: "Movies", icon: Film, match: (p: string) => p.startsWith("/movies") || p.startsWith("/search") || p.startsWith("/categories") },
    { href: "/webseries", label: "Series", icon: Tv, match: (p: string) => p.startsWith("/webseries") || p.startsWith("/tv") },
    { href: "/shorts", label: "Shorts", icon: Video, match: (p: string) => p.startsWith("/shorts") || p.startsWith("/kukutv") },
];

export default function BottomNav() {
    const pathname = usePathname() || "/";
    const [activeCount, setActiveCount] = useState(0);
    const [appMode, setAppMode] = useState(false);

    useEffect(() => {
        setAppMode(isAndroidApp());
        const sync = () => {
            const list = getDownloads();
            setActiveCount(list.filter((d) => d.status === "downloading" || d.status === "queued").length);
        };
        sync();
        window.addEventListener(DOWNLOADS_EVENT, sync);
        window.addEventListener("storage", sync);
        return () => {
            window.removeEventListener(DOWNLOADS_EVENT, sync);
            window.removeEventListener("storage", sync);
        };
    }, []);

    // Hide on admin screens
    if (pathname.startsWith("/admin")) return null;

    return (
        <nav
            className={cn(
                "fixed bottom-0 inset-x-0 z-[60] lg:hidden border-t border-white/10 bg-black/80 backdrop-blur-xl",
                appMode && "app-bottom-nav"
            )}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            aria-label="Primary"
        >
            <ul className={cn("grid", appMode ? "grid-cols-4" : "grid-cols-3")}>
                {(appMode ? APP_TABS : WEB_TABS).map(({ href, label, icon: Icon, match }) => {
                    const active = match(pathname);
                    return (
                        <li key={href}>
                            <Link
                                href={href}
                                className={cn(
                                    "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-bold tracking-wide transition-colors",
                                    active ? "text-accent" : "text-gray-400 hover:text-white"
                                )}
                            >
                                <span className="relative">
                                    <Icon className={cn("w-6 h-6", active && "drop-shadow-[0_0_10px_rgba(255,159,28,0.6)]")} />
                                    {href === "/downloads" && activeCount > 0 && (
                                        <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-accent text-black text-[10px] font-black flex items-center justify-center">
                                            {activeCount}
                                        </span>
                                    )}
                                </span>
                                {label}
                                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
