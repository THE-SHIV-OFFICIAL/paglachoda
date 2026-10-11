"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { addLocalActivity, flushActivity } from "@/lib/activity";

/**
 * Counts the time the user actually spends in the app (tab visible only) and
 * syncs it to the profile score every 30 seconds.
 */
export default function ActivityTracker() {
    const pathname = usePathname() || "/";

    useEffect(() => {
        const playing = pathname.startsWith("/watch");
        let ticks = 0;

        const tick = window.setInterval(() => {
            if (document.visibilityState !== "visible") return;
            addLocalActivity(5, playing);
            ticks += 1;
            if (ticks % 6 === 0) void flushActivity(); // every 30s
        }, 5000);

        const onHide = () => {
            if (document.visibilityState === "hidden") void flushActivity(true);
        };
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("pagehide", () => void flushActivity(true));

        return () => {
            window.clearInterval(tick);
            document.removeEventListener("visibilitychange", onHide);
            void flushActivity();
        };
    }, [pathname]);

    return null;
}
