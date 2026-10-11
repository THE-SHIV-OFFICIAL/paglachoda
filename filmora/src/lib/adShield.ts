"use client";

/**
 * Ad Shield — blocks popup / redirect style ads that player embeds try to open.
 * Layers:
 *  1. window.open is blocked unless the user genuinely clicked one of OUR links.
 *  2. Programmatic anchor clicks (a.click()) to foreign hosts are neutralised.
 *  3. Injected ad <a>/<iframe>/<script> nodes are removed on sight.
 *  4. Player iframes are sandboxed (see VideoPlayer) so they cannot navigate the top page.
 *
 * Install is reference counted: the global shield stays active even if a page
 * component that also installed it unmounts.
 */

const AD_HOST_HINTS = [
    "popads", "popcash", "propeller", "adsterra", "onclick", "clickadu", "hilltopads",
    "exoclick", "juicyads", "trafficjunky", "mgid", "adnxs", "doubleclick", "revcontent",
    "bidgear", "monetag", "zeropark", "smartadserver", "adservice", "advertising",
    "track.", "aff.", "cpm", "cpa", "banner", "ads.", "/ads", "adserver", "popunder",
];

/** Hosts our own UI is allowed to open in a new tab. */
const TRUSTED_HOSTS = [
    "t.me", "telegram.me", "telegram.org",
    "chromewebstore.google.com", "chrome.google.com",
    "adguard-dns.io", "adguard.com",
    "play.google.com", "apps.apple.com",
    "youtube.com", "youtu.be", "www.youtube.com",
];

let refCount = 0;
let teardown: (() => void) | null = null;
let blockedCount = 0;
const listeners = new Set<(n: number) => void>();

function bump() {
    blockedCount += 1;
    listeners.forEach((fn) => fn(blockedCount));
}

export function getBlockedCount() {
    return blockedCount;
}

export function onBlockedChange(fn: (n: number) => void) {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}

function hostOf(url: string): string | null {
    try {
        return new URL(url, window.location.href).hostname.toLowerCase();
    } catch {
        return null;
    }
}

function isTrusted(url: string) {
    const host = hostOf(url);
    if (!host) return false;
    if (host === window.location.hostname) return true;
    return TRUSTED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export function looksLikeAd(url: string) {
    if (isTrusted(url)) return false;
    const u = url.toLowerCase();
    if (u.startsWith("javascript:") || u.startsWith("data:")) return true;
    if (!u.startsWith("http")) return false;
    // Any other cross-site auto-popup is treated as an ad.
    return true;
}

function looksLikeAdNode(src: string) {
    const u = src.toLowerCase();
    if (!u) return false;
    if (isTrusted(u)) return false;
    return AD_HOST_HINTS.some((h) => u.includes(h));
}

function start() {
    // ---- Layer 1: window.open ----
    const nativeOpen = window.open.bind(window);
    let gestureAt = 0;
    let gestureHref: string | null = null;

    const markGesture = (e: Event) => {
        gestureAt = Date.now();
        const target = e.target as HTMLElement | null;
        const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
        gestureHref = anchor?.href || null;
    };
    document.addEventListener("pointerdown", markGesture, true);
    document.addEventListener("keydown", markGesture, true);

    const patchedOpen = (url?: string | URL, target?: string, features?: string) => {
        const href = typeof url === "string" ? url : url?.toString() || "";
        const fresh = Date.now() - gestureAt < 1000;
        const fromOurLink = !!gestureHref && !!href && (gestureHref === href || isTrusted(href));
        // Allow only: same-origin / trusted destinations opened right after a real
        // click on one of our own links.
        if (!fresh || !fromOurLink || looksLikeAd(href)) {
            bump();
            return null;
        }
        return nativeOpen(url as string, target, features);
    };
    (window as unknown as { open: unknown }).open = patchedOpen;

    // ---- Layer 2: anchor clicks (real + programmatic) ----
    const clickGuard = (e: MouseEvent) => {
        const el = (e.target as HTMLElement | null)?.closest?.("a") as HTMLAnchorElement | null;
        if (!el) return;
        const href = el.getAttribute("href") || "";
        if (!href) return;
        if (isTrusted(href)) return;
        if (!href.toLowerCase().startsWith("http")) return;
        if (looksLikeAdNode(href) || (!e.isTrusted && hostOf(href) !== window.location.hostname)) {
            e.preventDefault();
            e.stopPropagation();
            bump();
        }
    };
    document.addEventListener("click", clickGuard, true);

    // Programmatic a.click() is the classic popunder trick.
    const nativeAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function patchedAnchorClick(this: HTMLAnchorElement) {
        const href = this.getAttribute("href") || "";
        const fresh = Date.now() - gestureAt < 1000;
        if (href && !isTrusted(href) && (!fresh || looksLikeAdNode(href))) {
            bump();
            return;
        }
        return nativeAnchorClick.call(this);
    };

    // ---- Layer 3: injected ad nodes ----
    const scrub = (root: HTMLElement) => {
        const nodes: HTMLElement[] = [
            root,
            ...Array.from(root.querySelectorAll<HTMLElement>("a, iframe, script, embed, object")),
        ];
        nodes.forEach((n) => {
            const src = n.getAttribute("src") || n.getAttribute("href") || n.getAttribute("data") || "";
            if (src && looksLikeAdNode(src)) {
                n.remove();
                bump();
            }
        });
    };

    const observer = new MutationObserver((records) => {
        records.forEach((r) => {
            r.addedNodes.forEach((node) => {
                if (node instanceof HTMLElement) scrub(node);
            });
        });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
        document.removeEventListener("pointerdown", markGesture, true);
        document.removeEventListener("keydown", markGesture, true);
        document.removeEventListener("click", clickGuard, true);
        observer.disconnect();
        HTMLAnchorElement.prototype.click = nativeAnchorClick;
        window.open = nativeOpen;
    };
}

export function installAdShield() {
    if (typeof window === "undefined") return () => {};
    refCount += 1;
    if (refCount === 1) teardown = start();

    let released = false;
    return () => {
        if (released) return;
        released = true;
        refCount = Math.max(0, refCount - 1);
        if (refCount === 0 && teardown) {
            teardown();
            teardown = null;
        }
    };
}
