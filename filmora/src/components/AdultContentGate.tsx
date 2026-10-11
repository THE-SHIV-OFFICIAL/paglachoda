"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, LockKeyhole, ShieldAlert } from "lucide-react";

const AGE_GATE_KEY = "mb-18plus-approved";

export default function AdultContentGate({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [approved, setApproved] = useState<boolean | null>(null);

    useEffect(() => {
        try {
            setApproved(localStorage.getItem(AGE_GATE_KEY) === "yes");
        } catch {
            setApproved(false);
        }
    }, []);

    const accept = () => {
        try {
            localStorage.setItem(AGE_GATE_KEY, "yes");
        } catch {
            /* Continue for private browsing sessions. */
        }
        setApproved(true);
    };

    if (approved === null) {
        return <div className="min-h-[55vh] bg-[var(--prime-dark)]" aria-busy="true" />;
    }

    if (approved) return <>{children}</>;

    return (
        <main className="flex min-h-[75vh] items-center justify-center px-4 py-28 sm:px-6">
            <section className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-rose-400/20 bg-[var(--prime-card)] shadow-2xl shadow-rose-950/20">
                <div className="bg-gradient-to-br from-rose-950/70 via-black/30 to-amber-950/30 p-8 text-center sm:p-10">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-rose-300/25 bg-rose-400/10 text-rose-300">
                        <LockKeyhole className="h-8 w-8" />
                    </div>
                    <p className="mt-6 text-[10px] font-black uppercase tracking-[0.25em] text-rose-300">Age-restricted area</p>
                    <h1 className="mt-3 text-3xl font-black tracking-tight text-white">18+ content</h1>
                    <p className="mt-4 text-sm leading-relaxed text-gray-300">
                        This section is only for adults. Please confirm that you are 18 years of age or older before continuing.
                    </p>
                </div>

                <div className="space-y-4 p-6 sm:p-8">
                    <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-gray-400">
                        <ShieldAlert className="mt-0.5 h-4 w-4 flex-none text-amber-300" />
                        <span>By continuing, you confirm that you are above 18 and agree to use this section responsibly and lawfully.</span>
                    </div>
                    <button
                        type="button"
                        onClick={accept}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-400"
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        I&apos;m above 18 — Continue
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push("/webseries")}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-3.5 text-sm font-bold text-gray-300 transition hover:border-white/20 hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Go back
                    </button>
                </div>
            </section>
        </main>
    );
}