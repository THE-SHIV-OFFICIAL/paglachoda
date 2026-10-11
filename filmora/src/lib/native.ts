"use client";

/**
 * Bridge to the MOVIE BOX Android app (Capacitor + a small Java interface).
 *
 * The Android WebView injects `window.MovieBoxNative`. When it is present we
 * hand every download (APK or movie) to Android's DownloadManager so the file
 * lands in the phone's own storage: `Download/MovieBox/`. Notification progress
 * and "open with any player" then work exactly like a normal Android download.
 */

export interface MovieBoxNativeBridge {
    download?: (url: string, fileName: string, mimeType?: string) => void;
    openFile?: (fileName: string) => void;
    toast?: (message: string) => void;
    version?: string;
}

export function getNative(): MovieBoxNativeBridge | null {
    if (typeof window === "undefined") return null;
    const bridge = (window as unknown as { MovieBoxNative?: MovieBoxNativeBridge }).MovieBoxNative;
    return bridge && typeof bridge === "object" ? bridge : null;
}

/** True inside the installed Android app (not just Chrome on Android). */
export function isAndroidApp(): boolean {
    if (typeof window === "undefined") return false;
    if (getNative()?.download) return true;
    const ua = navigator.userAgent || "";
    return /MovieBoxApp/i.test(ua);
}

/** Ask Android to download into Download/MovieBox. Returns false on the web. */
export function nativeDownload(url: string, fileName: string, mimeType = "video/mp4"): boolean {
    const bridge = getNative();
    if (!bridge?.download) return false;
    try {
        bridge.download(url, fileName, mimeType);
        return true;
    } catch {
        return false;
    }
}

export function nativeOpen(fileName: string): boolean {
    const bridge = getNative();
    if (!bridge?.openFile) return false;
    try {
        bridge.openFile(fileName);
        return true;
    } catch {
        return false;
    }
}

export function nativeToast(message: string) {
    try {
        getNative()?.toast?.(message);
    } catch {
        /* ignore */
    }
}

/** Where a finished file lives on the phone. */
export const DEVICE_FOLDER = "Download/MovieBox";
