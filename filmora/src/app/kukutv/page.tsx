import MovieRow from "@/components/MovieRow";
import { tmdb } from "@/lib/tmdb";
import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const revalidate = 3600;

export const metadata: Metadata = {
    title: `KukuTV — Hindi Web Series & Mini Shows | ${siteConfig.name}`,
    description: `KukuTV style Hindi web series, mini shows and bold dramas on ${siteConfig.name} — watch in HD or download for offline playback.`,
    alternates: { canonical: `${siteConfig.url}/kukutv` },
};

export default async function KukuTvPage() {
    const [hindiSeries, newSeries, dramaSeries, crime, comedy, hindiMovies] = await Promise.all([
        tmdb.getDiscover("tv", { originalLanguage: "hi", withLanguage: "hi", voteCountGte: 5 }),
        tmdb.getDiscover("tv", { originalLanguage: "hi", sortBy: "first_air_date.desc", voteCountGte: 3, withLanguage: "hi" }),
        tmdb.getDiscover("tv", { originalLanguage: "hi", genreId: "18", voteCountGte: 3, withLanguage: "hi" }),
        tmdb.getDiscover("tv", { originalLanguage: "hi", genreId: "80", voteCountGte: 3, withLanguage: "hi" }),
        tmdb.getDiscover("tv", { originalLanguage: "hi", genreId: "35", voteCountGte: 3, withLanguage: "hi" }),
        tmdb.getDiscover("movie", { originalLanguage: "hi", withLanguage: "hi", voteCountGte: 20 }),
    ]);

    return (
        <main className="min-h-screen overflow-x-hidden pb-24 pt-28">
            <div className="mb-8 px-4 sm:px-6 lg:px-10">
                <span className="mb-pulse-glow inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-accent">
                    Hindi originals
                </span>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
                    <span className="mb-gradient-text">KukuTV</span>
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-400">
                    Hindi web series, mini shows and episodic dramas — short episodes, full Hindi audio.
                </p>
            </div>

            <div className="space-y-6 md:space-y-12">
                <MovieRow title="Popular on KukuTV" movies={hindiSeries} />
                <MovieRow title="New Episodes" movies={newSeries} />
                <MovieRow title="Drama Shows" movies={dramaSeries} />
                <MovieRow title="Crime & Thriller" movies={crime} />
                <MovieRow title="Comedy Shows" movies={comedy} />
                <MovieRow title="Hindi Movies" movies={hindiMovies} />
            </div>
        </main>
    );
}
