import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";
import AppDownloadClient from "./AppDownloadClient";

export const metadata: Metadata = {
    title: `Download the Android App (APK) | ${siteConfig.name}`,
    description: `Install the ${siteConfig.name} Android app — download movies and web series straight to your phone storage and watch them offline.`,
    alternates: { canonical: `${siteConfig.url}/app` },
};

export default function AppDownloadPage() {
    return <AppDownloadClient />;
}
