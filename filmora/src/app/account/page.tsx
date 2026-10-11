import { siteConfig } from "@/lib/config";
import ProfileCard from "@/components/ProfileCard";

export const metadata = {
    title: `My Profile | ${siteConfig.name}`,
    description: `Your ${siteConfig.name} profile, watch stats, downloads and history settings — no sign-in needed.`,
};

export default function AccountPage() {
    return <ProfileCard />;
}
