"use client";

import React, { useEffect, useState } from "react";
import { ExternalLink, Maximize2, Minimize2, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/config";

interface Props {
    title?: string;
}

export default function PlaybackQualityBar({ title }: Props) {
    const [isFull, setIsFull] = useState(false);

    useEffect(() => {
        const onChange = () => setIsFull(Boolean(document.fullscreenElement));
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
                return;
            }
            const target =
                (document.querySelector("[data-mb-player]") as HTMLElement | null) ??
                document.documentElement;
            await target.requestFullscreen?.();
        } catch {
            /* ignore — some in-app webviews block it */
        }
    };

    return (
        <div className={cn(
            "bg-black/60 border-t border-white/5 px-3 md:px-4 py-3 flex items-center justify-end gap-3",
            isFull && "hidden"
        )}>
            <a
                href={siteConfig.telegram}
                target="_blank"
                rel="noopener noreferrer"
                title={title ? `Updates from Beta Bot Hub — ${title}` : "Updates from Beta Bot Hub"}
                className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-[11px] font-black text-accent transition hover:bg-accent/20"
            >
                <Radio className="h-3.5 w-3.5" />
                Updates
                <span className="hidden sm:inline text-[10px] font-semibold opacity-70">Beta Bot Hub</span>
                <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
                type="button"
                onClick={toggleFullscreen}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
                {isFull ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {isFull ? "Exit fullscreen" : "Fullscreen"}
            </button>
        </div>
    );
}
