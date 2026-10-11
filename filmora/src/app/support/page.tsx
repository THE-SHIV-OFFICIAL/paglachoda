import React from "react";
import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";
import { betaSupport } from "@/lib/betaSupport";
import { Bot, MessageCircle, Radio, LifeBuoy, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
    title: `Support | ${siteConfig.name}`,
    description: `Get help with ${siteConfig.name} — Beta Bot support on Telegram for playback, download and account issues.`,
};

const cards = [
    {
        icon: <Bot className="h-5 w-5" />,
        label: "Beta Bot",
        title: "Chat with Beta Bot",
        body: "Fastest way to get help. Send your issue with the title name and Beta Bot picks it up right away.",
        link: betaSupport.bot.link,
        cta: "Open Beta Bot",
    },
    {
        icon: <MessageCircle className="h-5 w-5" />,
        label: "Community",
        title: "Beta Bot support chat",
        body: "Report broken sources, missing episodes or download problems and get a reply from the team.",
        link: betaSupport.supportGroups[0]?.link,
        cta: "Ask for help",
    },
    {
        icon: <Radio className="h-5 w-5" />,
        label: "Updates",
        title: "Updates channel",
        body: "New releases, server changes and downtime notices are posted here first.",
        link: betaSupport.updatesChannels[0]?.link,
        cta: "Follow updates",
    },
];

const faqs = [
    {
        q: "A title won't play — what should I do?",
        a: "Switch the source in the player bar. Beta, Videasy, 2Embed and Peachify are all available, and the player also switches automatically if a source stalls.",
    },
    {
        q: "The video is buffering a lot.",
        a: "Lower the quality from the quality bar (1080p → 720p), then reload the player. On mobile data, 720p is usually the smoothest.",
    },
    {
        q: "An episode or movie is missing.",
        a: "Send the exact title and year to Beta Bot. Missing entries are usually indexed within a day.",
    },
    {
        q: "Do you host the files?",
        a: `No. ${siteConfig.name} only indexes metadata and embeds third-party players. Nothing is stored on our servers.`,
    },
];

export default function SupportPage() {
    return (
        <main className="min-h-screen bg-[var(--prime-dark)]">
            <section className="relative overflow-hidden px-4 pt-24 pb-12 sm:px-6 sm:pt-32">
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(255,61,61,0.16) 0%, rgba(255,201,60,0.07) 45%, transparent 75%)",
                    }}
                />
                <div className="relative z-10 mx-auto max-w-4xl text-center">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-accent">
                        <LifeBuoy className="h-3.5 w-3.5" />
                        Support
                    </div>
                    <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground sm:text-5xl">
                        Need help?{" "}
                        <span
                            style={{
                                background: "linear-gradient(135deg, #FF3D3D 0%, #FFC93C 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                backgroundClip: "text",
                            }}
                        >
                            Beta Bot has you
                        </span>
                    </h1>
                    <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                        All {siteConfig.name} support runs through Beta Bot on Telegram — no tickets, no waiting rooms.
                    </p>
                </div>
            </section>

            <section className="px-4 pb-10 sm:px-6">
                <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {cards.map((c) => (
                        <div
                            key={c.title}
                            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[var(--prime-card)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/50"
                        >
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 text-accent">
                                {c.icon}
                            </div>
                            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--card-panel-muted)]">
                                {c.label}
                            </p>
                            <h2 className="mt-1 text-lg font-black tracking-tight text-foreground">{c.title}</h2>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                            {c.link && (
                                <a
                                    href={c.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-black text-black transition-opacity hover:opacity-90"
                                >
                                    {c.cta}
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            <section className="px-4 pb-24 sm:px-6">
                <div className="mx-auto max-w-3xl">
                    <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Quick answers</h2>
                    <div className="mt-6 space-y-3">
                        {faqs.map((f) => (
                            <div
                                key={f.q}
                                className="rounded-2xl border border-white/10 bg-[var(--prime-card)] p-5"
                            >
                                <h3 className="text-base font-bold text-foreground">{f.q}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}
