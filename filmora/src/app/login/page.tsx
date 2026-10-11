import { redirect } from "next/navigation";

/** Sign-in was removed — MOVIE BOX uses a device profile instead. */
export default function LoginPage() {
    redirect("/account");
}
