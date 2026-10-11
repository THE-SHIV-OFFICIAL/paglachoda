import React from 'react';
import Link from 'next/link';
import { siteConfig } from "@/lib/config";
import { betaSupport } from "@/lib/betaSupport";
import BrandLogo from "@/components/BrandLogo";

const Footer = () => {
    const updates = betaSupport.updatesChannels[0];
    const support = betaSupport.supportGroups[0];

    return (
        <footer className="mt-16 border-t border-[var(--footer-border)] bg-background text-sm text-muted-foreground">

            {/* ── Main row ── */}
            <div className="container mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">

                {/* Left: Brand + nav */}
                <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
                    <Link href="/" className="flex-shrink-0">
                        <BrandLogo iconClass="h-8 w-8" textClass="text-[18px]" />
                    </Link>
                    <nav className="flex flex-wrap justify-center gap-5 text-sm">
                        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
                        <Link href="/overview" className="hover:text-foreground transition-colors">Overview</Link>
                        <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
                        <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
                        <Link href="/dmca" className="hover:text-foreground transition-colors">DMCA</Link>
                        <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                    </nav>
                </div>

                {/* Middle: Disclaimer */}
                <p className="text-sm text-muted-foreground max-w-sm hidden md:block text-center mx-auto leading-relaxed">
                    {siteConfig.name} does not host any content on our servers.
                </p>

                {/* Right: Copyright */}
                <div className="text-sm font-semibold text-foreground/70 flex-shrink-0">
                    &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
                </div>
            </div>

            {/* ── Support bar ── */}
            <div className="border-t border-[var(--footer-border)]/60 py-4 px-6">
                <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-muted-foreground">
                    <Link href="/support" className="font-semibold text-accent hover:text-accent/80 transition-colors">
                        Beta Bot Support
                    </Link>
                    {updates?.link && (
                        <>
                            <span className="hidden sm:block w-px h-4 bg-muted-foreground/30" />
                            <a
                                href={updates.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold hover:text-foreground transition-colors"
                            >
                                Updates
                            </a>
                        </>
                    )}
                    {support?.link && (
                        <>
                            <span className="hidden sm:block w-px h-4 bg-muted-foreground/30" />
                            <a
                                href={support.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold hover:text-foreground transition-colors"
                            >
                                Telegram
                            </a>
                        </>
                    )}
                    <span className="hidden sm:block w-px h-4 bg-muted-foreground/30" />
                    <Link href="/overview" className="font-semibold hover:text-foreground transition-colors">
                        Live Overview
                    </Link>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
