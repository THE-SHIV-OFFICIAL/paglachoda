import React from "react";
import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";
import OverviewClient from "./OverviewClient";

export const metadata: Metadata = {
    title: `Overview | ${siteConfig.name}`,
    description: `Live overview of ${siteConfig.name} — visitors, uptime, response speed and the last site update.`,
};

export default function OverviewPage() {
    return <OverviewClient />;
}
