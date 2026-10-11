import { promises as fs } from "fs";
import path from "path";
import { siteConfig } from "@/lib/config";

/**
 * Direct APK download. Serves the bundled file with the Android package MIME
 * type and an attachment header so phones save a real, installable .apk.
 * If NEXT_PUBLIC_APK_URL is set (external host), redirect there instead.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    if (siteConfig.apkUrl) {
        return new Response(null, { status: 302, headers: { Location: siteConfig.apkUrl, "Cache-Control": "no-store" } });
    }
    try {
        const file = path.join(process.cwd(), "public", "downloads", "moviebox.apk");
        const data = await fs.readFile(file);
        return new Response(new Uint8Array(data), {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.android.package-archive",
                "Content-Disposition": 'attachment; filename="MovieBox.apk"',
                "Content-Length": String(data.byteLength),
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return Response.json({ error: "APK not found on server." }, { status: 404 });
    }
}
