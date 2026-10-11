import type { Metadata } from "next";
import { Film, ShieldCheck, Tv } from "lucide-react";
import MovieRow from "@/components/MovieRow";
import AdultContentGate from "@/components/AdultContentGate";
import IndexedMoviesPage from "@/components/IndexedMoviesPage";
import { tmdb } from "@/lib/tmdb";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
    title: `18+ Movies & Web Series | ${siteConfig.name}`,
    description: `Age-restricted movies and web series on ${siteConfig.name}.`,
    robots: { index: false, follow: false },
};

export default async function AdultPage() {
    const [adultMovies, adultSeries] = await Promise.all([
        tmdb.getDiscover("movie", { includeAdult: true, voteCountGte: 0 }),
        tmdb.getDiscover("tv", { includeAdult: true, voteCountGte: 0 }),
    ]);

    return (
        <AdultContentGate>
            <main className="min-h-screen overflow-x-hidden pb-24 pt-28">
                <section className="px-4 pb-10 sm:px-6 lg:px-10">
                    <div className="mx-auto max-w-6xl rounded-[2rem] border border-rose-400/20 bg-gradient-to-br from-rose-950/40 via-[var(--prime-card)] to-amber-950/20 p-7 sm:p-10">
                        <div className="flex flex-wrap items-start justify-between gap-6">
                            <div className="max-w-2xl">
                                <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-rose-200">
                                    <ShieldCheck className="h-3.5 w-3.5" /> Age gate active
                                </div>
                                <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-5xl">18+ Movies &amp; Web Series</h1>
                                <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-300">
                                    Adult-rated titles are kept in their own section and remain hidden until age approval is given on this device.
                                </p>
                            </div>
                            <div className="flex gap-2 text-rose-200">
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><Film className="h-5 w-5" /></div>
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><Tv className="h-5 w-5" /></div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="space-y-8">
                    <MovieRow title="18+ Movies" movies={adultMovies} />
                    <MovieRow title="18+ Web Series" movies={adultSeries} />
                </div>
                <section className="mt-12 border-t border-white/5 pt-10">
                    <div className="mb-4 px-4 sm:px-6 lg:px-10">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-300">Bot catalog</p>
                        <p className="mt-2 text-sm text-gray-400">All indexed files marked 18+, adult, uncensored or XXX appear here when available.</p>
                    </div>
                    <IndexedMoviesPage botUsername={siteConfig.botUsername} adultOnly />
                </section>
            </main>
        </AdultContentGate>
    );
}