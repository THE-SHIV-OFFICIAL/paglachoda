import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: "Unlimited movies and TV shows for free. Movies | Series | Anime | More.",
    id: "/",
    start_url: "/",
    display: "standalone",
    prefer_related_applications: false,
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "any",
    scope: "/",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
