"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Menu, X, ArrowLeft, ChevronLeft, ChevronRight, Dices, Download, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { surpriseMe } from "@/app/actions";
import { siteConfig } from "@/lib/config";
import ThemeToggle from "@/components/ThemeToggle";
import BrandLogo from "@/components/BrandLogo";
import VoiceSearchOverlay from "@/components/VoiceSearchOverlay";

const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const lastScrollYRef = React.useRef(0);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isPending, startTransition] = React.useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const mobileInputRef = React.useRef<HTMLInputElement>(null);
    const desktopInputRef = React.useRef<HTMLInputElement>(null);
    const navSliderRef = React.useRef<HTMLDivElement>(null);
    const [navScrollState, setNavScrollState] = useState({ left: false, right: false });

    const [pwaPrompt, setPwaPrompt] = useState<any>(null);
    const [isListening, setIsListening] = useState(false);
    const [isVoiceOverlayOpen, setIsVoiceOverlayOpen] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState("");
    const recognitionRef = React.useRef<any>(null);

    const closeVoiceOverlay = () => {
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (_) {}
            recognitionRef.current = null;
        }
        setIsVoiceOverlayOpen(false);
        setIsListening(false);
        setVoiceTranscript("");
    };

    const handleVoiceSearch = () => {
        if (typeof window === "undefined") return;

        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setIsVoiceOverlayOpen(true);
            setIsListening(false);
            setVoiceTranscript("Voice search not supported. Please use Chrome or Safari.");
            setTimeout(closeVoiceOverlay, 2500);
            return;
        }

        setVoiceTranscript("");
        setIsVoiceOverlayOpen(true);

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.lang = "en-US";
        recognition.interimResults = false;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onerror = () => {
            setIsListening(false);
            setTimeout(closeVoiceOverlay, 800);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                setVoiceTranscript(transcript);
                setSearchQuery(transcript);
                setTimeout(() => {
                    router.push(`/search?q=${encodeURIComponent(transcript.trim())}`, { scroll: false });
                    setIsSearchOpen(false);
                    setIsMobileMenuOpen(false);
                    closeVoiceOverlay();
                }, 700);
            }
        };

        recognition.start();
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            const handleInstallReady = () => {
                setPwaPrompt(window.deferredPrompt);
            };
            const handleInstalled = () => {
                setPwaPrompt(null);
            };

            window.addEventListener("pwa-install-ready", handleInstallReady);
            window.addEventListener("pwa-installed", handleInstalled);

            if (window.deferredPrompt) {
                setPwaPrompt(window.deferredPrompt);
            }

            return () => {
                window.removeEventListener("pwa-install-ready", handleInstallReady);
                window.removeEventListener("pwa-installed", handleInstalled);
            };
        }
    }, []);

    const handlePwaInstall = async () => {
        const promptEvent = pwaPrompt || window.deferredPrompt;
        if (!promptEvent) return;

        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        console.log(`[PWA Navbar] Install choice: ${outcome}`);
        
        try {
            if (outcome === "accepted") {
                localStorage.setItem("pwa-installed", "true");
            } else {
                localStorage.setItem("pwa-prompt-dismissed-time", Date.now().toString());
            }
        } catch (e) {
            console.warn("localStorage set item failed in Navbar:", e);
        }

        setPwaPrompt(null);
        window.deferredPrompt = null;
        window.dispatchEvent(new CustomEvent("pwa-installed"));
    };

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const lastScrollY = lastScrollYRef.current;

            // Hide on scroll down, show on scroll up
            if (currentScrollY > lastScrollY && currentScrollY > 80) {
                setIsVisible(prev => prev ? false : prev);
            } else {
                setIsVisible(prev => !prev ? true : prev);
            }

            lastScrollYRef.current = currentScrollY;

            if (currentScrollY > 0) {
                setIsScrolled(prev => prev ? prev : true);
            } else {
                setIsScrolled(prev => !prev ? prev : false);
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Sync search query with URL (for back/forward navigation or direct links)
    useEffect(() => {
        const q = searchParams.get("q") || "";

        // Only update searchQuery state from the URL if they differ,
        // and we aren't currently focused on a search input (which means the user is typing)
        const activeEl = document.activeElement;
        const isInputFocused = activeEl && (
            activeEl.tagName === "INPUT" &&
            (activeEl.getAttribute("placeholder")?.includes("Search") || activeEl.getAttribute("type") === "text")
        );

        if (q !== searchQuery && !isInputFocused) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSearchQuery(q);
        }
        if (pathname === "/search" && q) {
            if (typeof window !== "undefined" && window.innerWidth < 768) {
                setIsSearchOpen(true);
            }
        }
    }, [searchParams, pathname, searchQuery]);

    // Preserve focus during route transitions or layout shifts
    useEffect(() => {
        const activeEl = document.activeElement;
        const isMobileActive = activeEl && mobileInputRef.current && (activeEl === mobileInputRef.current || mobileInputRef.current.contains(activeEl));
        const isDesktopActive = activeEl && desktopInputRef.current && (activeEl === desktopInputRef.current || desktopInputRef.current.contains(activeEl));

        if (isMobileActive || isDesktopActive) {
            const focusTarget = isMobileActive ? mobileInputRef.current : desktopInputRef.current;
            if (focusTarget) {
                const handleFocus = () => {
                    if (focusTarget && document.activeElement !== focusTarget) {
                        focusTarget.focus();
                        // Maintain cursor position at the end of text
                        const val = focusTarget.value;
                        focusTarget.value = "";
                        focusTarget.value = val;
                    }
                };

                requestAnimationFrame(handleFocus);
                setTimeout(handleFocus, 50);
                setTimeout(handleFocus, 150);
            }
        }
    }, [pathname, searchParams]);

    // Close search/menu on route change
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsMobileMenuOpen(false);
        // Only close search if we're not on the search page
        if (pathname !== "/search") {
            setIsSearchOpen(false);
        }
    }, [pathname]);

    // Debounce updating the URL query param while typing to prevent race conditions
    useEffect(() => {
        const q = searchParams.get("q") || "";
        const queryVal = searchQuery.trim();

        if (queryVal === q.trim()) return;

        const timer = setTimeout(() => {
            if (queryVal) {
                if (pathname !== "/search") {
                    router.push(`/search?q=${encodeURIComponent(queryVal)}`, { scroll: false });
                } else {
                    router.replace(`/search?q=${encodeURIComponent(queryVal)}`, { scroll: false });
                }
            } else {
                if (pathname === "/search") {
                    router.replace("/search", { scroll: false });
                }
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, pathname, router, searchParams]);

    const handleSearch = (e?: React.FormEvent | React.MouseEvent) => {
        if (e) e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`, { scroll: false });
            setIsMobileMenuOpen(false);
            setIsSearchOpen(false);
        }
    };

    const handleSearchInputChange = (value: string) => {
        setSearchQuery(value);
        if (!value.trim()) {
            if (pathname === "/search") {
                router.replace("/search", { scroll: false });
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    const navLinks: Array<{ name: string; href: string; external?: boolean }> = [
        { name: "Home", href: "/" },
        { name: "Movies", href: "/movies" },
        { name: "Web Series", href: "/webseries" },
        { name: "18+", href: "/18-plus" },
        { name: "Cartoon", href: "/cartoon" },
        { name: "TV Shows", href: "/tv" },
        { name: "Categories", href: "/categories" },
        { name: "Download App", href: "/app" },
        { name: "Overview", href: "/overview" },
        { name: "Updates", href: siteConfig.telegram, external: true },
        { name: "My List", href: "/watchlist" },
        { name: "K-Drama", href: "/kdrama" },
        { name: "KukuTV", href: "/kukutv" },
        { name: "Short Movies", href: "/shorts" },
        { name: "Support", href: "/support" },
        { name: "Profile", href: "/account" },
    ];

    const updateNavScrollState = React.useCallback(() => {
        const slider = navSliderRef.current;
        if (!slider) return;

        const maxScrollLeft = slider.scrollWidth - slider.clientWidth;
        setNavScrollState({
            left: slider.scrollLeft > 4,
            right: slider.scrollLeft < maxScrollLeft - 4,
        });
    }, []);

    const slideNav = (direction: "left" | "right") => {
        const slider = navSliderRef.current;
        if (!slider) return;

        slider.scrollBy({
            left: direction === "left" ? -Math.max(220, slider.clientWidth * 0.65) : Math.max(220, slider.clientWidth * 0.65),
            behavior: "smooth",
        });
    };

    useEffect(() => {
        const slider = navSliderRef.current;
        if (!slider) return;

        updateNavScrollState();
        const frame = requestAnimationFrame(updateNavScrollState);
        const observer = new ResizeObserver(updateNavScrollState);
        observer.observe(slider);
        for (const child of slider.children) observer.observe(child);
        window.addEventListener("resize", updateNavScrollState);

        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", updateNavScrollState);
        };
    }, [updateNavScrollState]);

    if (
        pathname?.startsWith("/person/") ||
        pathname?.startsWith("/watch/") ||
        pathname?.startsWith("/company/") ||
        pathname?.startsWith("/network/") ||
        pathname === "/terms" ||
        pathname === "/dmca" ||
        pathname === "/privacy" ||
        pathname === "/about"
    ) {
        return null;
    }

    return (
        <>
        <VoiceSearchOverlay
            isOpen={isVoiceOverlayOpen}
            isListening={isListening}
            transcript={voiceTranscript}
            onClose={closeVoiceOverlay}
        />
        <nav
            className={cn(
                "fixed top-4 left-1/2 z-50 w-[95%] md:w-[min(96vw,1440px)] max-w-[98vw] px-3 md:px-6 py-2 glass-pill",
                "transition-[transform,opacity,background-color] duration-300 ease-out will-change-transform",
                isScrolled ? "bg-black/60 shadow-2xl" : "bg-black/20"
            )}
            style={{
                transform: `translateX(-50%) translateY(${isVisible || isMobileMenuOpen || isSearchOpen ? "0px" : "-160%"})`,
                opacity: isVisible || isMobileMenuOpen || isSearchOpen ? 1 : 0,
                pointerEvents: isVisible || isMobileMenuOpen || isSearchOpen ? "auto" : "none",
            }}
        >
            <div className="flex items-center justify-between h-14">
                <AnimatePresence mode="wait">
                    {isSearchOpen ? (
                        <motion.div
                            key="search-bar"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex-1 flex items-center bg-white/5 border border-white/10 backdrop-blur-sm rounded-full px-2"
                        >
                            <button
                                onClick={() => {
                                    setIsSearchOpen(false);
                                    if (pathname === "/search") {
                                        router.back();
                                    }
                                }}
                                className="p-2 text-gray-400 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                             <input
                                ref={mobileInputRef}
                                autoFocus
                                type="text"
                                placeholder="Search titles, people, studios..."
                                value={searchQuery}
                                onChange={(e) => handleSearchInputChange(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                className="bg-transparent border-none outline-none text-white text-base w-full placeholder-gray-500 py-2"
                            />
                            <button
                                type="button"
                                onClick={handleVoiceSearch}
                                className={cn(
                                    "p-2 rounded-full transition-all text-gray-400 hover:text-white mr-1",
                                    isListening && "text-red-500 animate-pulse bg-red-500/10 scale-110"
                                )}
                                title="Voice Search"
                            >
                                <Mic className="h-5 w-5" />
                            </button>
                            {searchQuery && (
                                <button
                                    onClick={() => handleSearchInputChange("")}
                                    className="p-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="navbar-content"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex min-w-0 items-center justify-between w-full gap-3 lg:gap-5"
                        >
                            <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3 lg:gap-5">
                                <Link href="/" className="group flex-shrink-0 flex items-center gap-2">
                                    <motion.div
                                        className="flex items-center gap-2"
                                        whileHover={{ scale: 1.05 }}
                                        transition={{ duration: 0.25 }}
                                    >
                                        <BrandLogo
                                            stacked
                                            showBy
                                            iconClass="h-8 w-8 sm:h-9 sm:w-9"
                                            textClass="text-[12px] sm:text-[14px]"
                                        />
                                    </motion.div>
                                </Link>

                                {/* Primary search — front and centre */}
                                <form
                                    onSubmit={handleSearch}
                                    className="web-nav-search hidden sm:flex shrink-0 items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1.5 focus-within:ring-2 focus-within:ring-accent/60 focus-within:bg-white/[0.14] transition-all"
                                >
                                    <Search
                                        className="h-4 w-4 text-accent shrink-0 cursor-pointer"
                                        onClick={() => handleSearch()}
                                    />
                                    <input
                                        ref={desktopInputRef}
                                        type="text"
                                        placeholder="Search movies, series, people..."
                                        value={searchQuery}
                                        onChange={(e) => handleSearchInputChange(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className="bg-transparent border-none py-0.5 text-[13px] text-white placeholder-gray-400 outline-none w-32 md:w-40 lg:w-52 focus:w-56 lg:focus:w-64 transition-all duration-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleVoiceSearch}
                                        className={cn(
                                            "p-1 rounded-full transition-all text-gray-400 hover:text-white flex items-center justify-center",
                                            isListening && "text-red-500 animate-pulse bg-red-500/10 scale-110"
                                        )}
                                        title="Voice Search"
                                    >
                                        <Mic className="h-4 w-4" />
                                    </button>
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => handleSearchInputChange("")}
                                            className="p-1 text-gray-400 hover:text-white transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </form>


                                <div className="web-nav-rail relative hidden md:flex min-w-0 flex-1 items-center">
                                    <button
                                        type="button"
                                        onClick={() => slideNav("left")}
                                        aria-label="Previous menu items"
                                        title="Previous menu items"
                                        className={cn(
                                            "absolute left-0 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg backdrop-blur-md transition-all hover:bg-accent hover:text-black",
                                            navScrollState.left ? "opacity-100" : "pointer-events-none opacity-0"
                                        )}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <div
                                        ref={navSliderRef}
                                        onScroll={updateNavScrollState}
                                        className="flex w-full min-w-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain scroll-smooth px-1 py-1 scrollbar-none lg:gap-1 xl:gap-1.5"
                                        style={{ touchAction: "pan-x" }}
                                        data-horizontal-rail
                                    >
                                        {navLinks.map((link) => {
                                        const isActive = pathname === link.href;
                                        const item = (
                                            <>
                                                {isActive && (
                                                    <motion.span
                                                        layoutId="activeNavTab"
                                                        className="absolute inset-0 bg-white/10 rounded-full z-[-1]"
                                                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                                    />
                                                )}
                                                <span className={cn(isActive && "text-white")}>{link.name}</span>
                                            </>
                                        );
                                        const props = {
                                            id: link.href === "/watchlist" ? "nav-watchlist" : undefined,
                                            href: link.href,
                                            className: "relative text-[11px] lg:text-[13px] xl:text-[14px] font-semibold px-2.5 lg:px-3.5 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors duration-300 text-gray-400 hover:text-white",
                                        };
                                        return link.external ? (
                                            <a key={link.name} {...props} target="_blank" rel="noopener noreferrer">{item}</a>
                                        ) : (
                                            <Link key={link.name} {...props}>{item}</Link>
                                        );
                                        })}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => slideNav("right")}
                                        aria-label="Next menu items"
                                        title="Next menu items"
                                        className={cn(
                                            "absolute right-0 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg backdrop-blur-md transition-all hover:bg-accent hover:text-black",
                                            navScrollState.right ? "opacity-100" : "pointer-events-none opacity-0"
                                        )}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="app-header-actions flex items-center gap-2 md:gap-3 flex-shrink-0">
                                {/* Search lives at the front of the bar now */}


                                {/* Surprise Me Button */}
                                <motion.button
                                    disabled={isPending}
                                    onClick={() => startTransition(() => surpriseMe())}
                                    whileHover="hover"
                                    className={cn(
                                        "p-2 text-gray-400 hover:text-accent transition-all duration-300 rounded-full hover:bg-white/10 flex items-center justify-center relative",
                                        isPending && "animate-pulse opacity-50"
                                    )}
                                    title="Surprise Me"
                                >
                                    <motion.div
                                        variants={{
                                            hover: { rotate: 360, scale: 1.15 }
                                        }}
                                        transition={{ type: "spring", stiffness: 200 }}
                                    >
                                        <Dices className={cn("h-5 w-5", isPending && "animate-spin-slow")} />
                                    </motion.div>

                                    {/* Floating paw print particles on hover */}
                                    <motion.span
                                        className="absolute -top-3 -right-1 text-[10px] pointer-events-none opacity-0 select-none"
                                        variants={{
                                            hover: {
                                                opacity: [0, 1, 0],
                                                y: [-5, -15],
                                                x: [0, 5],
                                                transition: { duration: 0.8, repeat: Infinity }
                                            }
                                        }}
                                    >
                                        🐾
                                    </motion.span>
                                    <motion.span
                                        className="absolute -top-4 -left-1 text-[8px] pointer-events-none opacity-0 select-none"
                                        variants={{
                                            hover: {
                                                opacity: [0, 1, 0],
                                                y: [-4, -18],
                                                x: [0, -4],
                                                transition: { duration: 0.8, delay: 0.3, repeat: Infinity }
                                            }
                                        }}
                                    >
                                        🐾
                                    </motion.span>
                                </motion.button>

                                {/* Theme Toggle */}
                                <ThemeToggle />

                                {/* PWA Install Action Icon */}
                                {pwaPrompt && (
                                    <button
                                        onClick={handlePwaInstall}
                                        className="p-2 text-gray-400 hover:text-accent transition-all duration-300 rounded-full hover:bg-white/10 flex items-center justify-center relative group"
                                        title={`Install ${siteConfig.name}`}
                                    >
                                        <Download className="h-5 w-5 animate-pulse text-amber-400" />
                                    </button>
                                )}

                                {/* Mobile Search Toggle */}
                                <button
                                    onClick={() => setIsSearchOpen(true)}
                                    className="md:hidden text-white p-2 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
                                >
                                    <Search className="h-5 w-5" />
                                </button>

                                <button
                                    className="app-menu-toggle md:hidden text-white p-2 hover:bg-white/10 rounded-full transition-colors"
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                >
                                    {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="app-menu-drawer md:hidden absolute top-[calc(100%+12px)] left-0 w-full overflow-hidden bg-black/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl z-50 origin-top"
                    >
                        <div className="flex flex-col p-4 space-y-2">
                            {/* Mobile Links */}
                            <div className="grid grid-cols-1 gap-1">
                                {navLinks.map((link) => {
                                    const mobileClass = cn(
                                        "text-[16px] font-bold px-5 py-4 rounded-2xl transition-all duration-300 flex items-center justify-between group",
                                        pathname === link.href
                                            ? "bg-accent text-black"
                                            : "text-gray-400 hover:bg-white/5 hover:text-white"
                                    );
                                    const content = (
                                        <>
                                            <span>{link.name}</span>
                                            {pathname === link.href && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                                        </>
                                    );
                                    return link.external ? (
                                        <a
                                            key={link.name}
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={mobileClass}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            {content}
                                        </a>
                                    ) : (
                                        <Link
                                            key={link.name}
                                            href={link.href}
                                            className={mobileClass}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            {content}
                                        </Link>
                                    );
                                })}

                                {/* PWA Install Button in Drawer */}
                                {pwaPrompt && (
                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            handlePwaInstall();
                                        }}
                                        className="mt-3 text-[16px] font-bold px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-amber-400 hover:bg-white/10 hover:text-amber-300 transition-all duration-300 flex items-center justify-between group cursor-pointer"
                                    >
                                        <span>Install App Extension</span>
                                        <Download className="h-5 w-5 text-amber-400 group-hover:translate-y-0.5 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
        </>
    );
};

export default Navbar;
