import MovieRow from "@/components/MovieRow";
import { tmdb } from "@/lib/tmdb";
import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const revalidate = 3600;

export const metadata: Metadata = {
    title: `Short Movies & Short Films in Hindi | ${siteConfig.name}`,
    description: `Short films and quick movies under 75 minutes on ${siteConfig.name} — Hindi first, stream in HD or download for offline watching.`,
    alternates: { canonical: `${siteConfig.url}/shorts` },
};

export default async function ShortMoviesPage() {
    const [hindiShorts, popularShorts, drama, comedy, thriller, animated] = await Promise.all([
        tmdb.getDiscover("movie", { originalLanguage: "hi", runtimeLte: 75, voteCountGte: 3, withLanguage: "hi" }),
        tmdb.getDiscover("movie", { runtimeLte: 60, voteCountGte: 30, withLanguage: "hi" }),
        tmdb.getDiscover("movie", { genreId: "18", runtimeLte: 75, voteCountGte: 10, withLanguage: "hi" }),
        tmdb.getDiscover("movie", { genreId: "35", runtimeLte: 75, voteCountGte: 10, withLanguage: "hi" }),
        tmdb.getDiscover("movie", { genreId: "53", runtimeLte: 75, voteCountGte: 10, withLanguage: "hi" }),
        tmdb.getDiscover("movie", { genreId: "16", runtimeLte: 50, voteCountGte: 20, withLanguage: "hi" }),
    ]);

    return (
        <main className="min-h-screen overflow-x-hidden pb-24 pt-28">
            <div className="mb-8 px-4 sm:px-6 lg:px-10">
                <span className="mb-pulse-glow inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-accent">
                    Under 75 minutes
                </span>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
                    <span className="mb-gradient-text">Short Movies</span>
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-400">
                    Quick watches and short films with Hindi audio — perfect for one sitting, and small enough to
                    download in seconds.
                </p>
            </div>

            <div className="space-y-6 md:space-y-12">
                <MovieRow title="Hindi Short Films" movies={hindiShorts} />
                <MovieRow title="Popular Shorts" movies={popularShorts} />
                <MovieRow title="Short Drama" movies={drama} />
                <MovieRow title="Short Comedy" movies={comedy} />
                <MovieRow title="Short Thriller" movies={thriller} />
                <MovieRow title="Animated Shorts" movies={animated} />
            </div>
        </main>
    );
}
