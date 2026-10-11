import { siteConfig } from "@/lib/config";
import DownloadsClient from "./DownloadsClient";

export const metadata = {
    title: `My Downloads | ${siteConfig.name}`,
    description: `See and manage every movie, web series and cartoon you downloaded on ${siteConfig.name}.`,
    openGraph: {
        title: `My Downloads | ${siteConfig.name}`,
        description: `See and manage every movie you downloaded on ${siteConfig.name}.`,
    },
};

export default function DownloadsPage() {
    return <DownloadsClient />;
}
