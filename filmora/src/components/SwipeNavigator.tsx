"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Main sections a left/right swipe moves between, in order. */
const SECTIONS: Array<{ href: string; label: string }> = [
    { href: "/", label: "Home" },
    { href: "/movies", label: "Movies" },
    { href: "/webseries", label: "Web Series" },
    { href: "/tv", label: "TV Shows" },
    { href: "/cartoon", label: "Cartoon" },
    { href: "/categories", label: "Categories" },
    { href: "/watchlist", label: "My List" },
    { href: "/downloads", label: "Downloads" },
    { href: "/account", label: "Profile" },
];

const BLOCKED_PREFIXES = ["/admin", "/watch", "/login"];
const SWIPE_DISTANCE = 70;
const MAX_VERTICAL_DRIFT = 55;

function sectionIndex(pathname: string): number {
    if (pathname === "/") return 0;
    return SECTIONS.findIndex((s) => s.href !== "/" && pathname.startsWith(s.href));
}

/**
 * Lets people flick left / right to move between the main sections, the way a
 * native app feels. Vertical scrolling and pinch-zoom are untouched.
 */
export default function SwipeNavigator({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname() || "/";
    const start = useRef<{ x: number; y: number; time: number } | null>(null);
    const [hint, setHint] = useState<{ label: string; dir: "left" | "right" } | null>(null);

    const disabled = BLOCKED_PREFIXES.some((p) => pathname.startsWith(p));

    useEffect(() => {
        if (disabled) return;

        const index = sectionIndex(pathname);
        if (index < 0) return;

        const go = (dir: 1 | -1) => {
            const next = SECTIONS[index + dir];
            if (!next) return;
            setHint({ label: next.label, dir: dir === 1 ? "left" : "right" });
            router.push(next.href);
            window.setTimeout(() => setHint(null), 700);
        };

        const onStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) {
                start.current = null;
                return;
            }
            const t = e.touches[0];
            start.current = { x: t.clientX, y: t.clientY, time: Date.now() };
        };

        const onEnd = (e: TouchEvent) => {
            const from = start.current;
            start.current = null;
            if (!from) return;
            const t = e.changedTouches[0];
            if (!t) return;
            const dx = t.clientX - from.x;
            const dy = t.clientY - from.y;
            if (Date.now() - from.time > 800) return;
            if (Math.abs(dy) > MAX_VERTICAL_DRIFT) return;
            if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.6) return;

            // Don't hijack swipes inside horizontal carousels / rails.
            let node = t.target as HTMLElement | null;
            while (node && node !== document.body) {
                if (node.hasAttribute("data-horizontal-rail")) return;
                const style = window.getComputedStyle(node);
                const scrollsX =
                    (style.overflowX === "auto" || style.overflowX === "scroll") &&
                    node.scrollWidth > node.clientWidth + 8;
                if (scrollsX) return;
                node = node.parentElement;
            }

            go(dx < 0 ? 1 : -1);
        };

        window.addEventListener("touchstart", onStart, { passive: true });
        window.addEventListener("touchend", onEnd, { passive: true });
        return () => {
            window.removeEventListener("touchstart", onStart);
            window.removeEventListener("touchend", onEnd);
        };
    }, [pathname, router, disabled]);

    return (
        <>
            {children}
            <AnimatePresence>
                {hint && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        className="pointer-events-none fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 lg:hidden"
                    >
                        <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/80 px-4 py-2 text-xs font-black text-white backdrop-blur-md">
                            {hint.dir === "right" && <ChevronLeft className="h-3.5 w-3.5 text-accent" />}
                            {hint.label}
                            {hint.dir === "left" && <ChevronRight className="h-3.5 w-3.5 text-accent" />}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
