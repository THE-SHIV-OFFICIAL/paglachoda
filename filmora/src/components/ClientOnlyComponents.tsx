"use client";

import dynamic from 'next/dynamic';

const FlyingParticles = dynamic(() => import("@/components/FlyingParticles"), { ssr: false });
const TelegramToast = dynamic(() => import("@/components/TelegramToast"), { ssr: false });
const SplashScreen = dynamic(() => import("@/components/SplashScreen"), { ssr: false });
const AppPrefsBridge = dynamic(() => import("@/components/AppPrefsBridge"), { ssr: false });
const PwaRegister = dynamic(() => import("@/components/PwaRegister"), { ssr: false });
const DownloadProgressPopup = dynamic(() => import("@/components/DownloadProgressPopup"), { ssr: false });

export default function ClientOnlyComponents() {
  return (
    <>
      <SplashScreen />
      <AppPrefsBridge />
      <PwaRegister />
      <FlyingParticles />
      <TelegramToast />
      <DownloadProgressPopup />
    </>
  );
}
