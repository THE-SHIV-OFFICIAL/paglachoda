import MovieRow from "@/components/MovieRow";
import { tmdb } from "@/lib/tmdb";
import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const revalidate = 3600;

export const metadata: Metadata = {
    title: `K-Drama in Hindi — Watch Korean Series Free | ${siteConfig.name}`,
    description: `Popular Korean dramas and movies with Hindi audio on ${siteConfig.name} — stream in HD or download for offline watching.`,
    alternates: { canonical: `${siteConfig.url}/kdrama` },
};

export default async function KDramaPage() {
    const [trending, topRated, romance, thriller, action, kMovies] = await Promise.all([
        tmdb.getDiscover("tv", { originCountry: "KR", withLanguage: "hi", voteCountGte: 40 }),
        tmdb.getDiscover("tv", { originCountry: "KR", sortBy: "vote_average.desc", voteCountGte: 200, withLanguage: "hi" }),
        tmdb.getDiscover("tv", { originCountry: "KR", genreId: "18", withLanguage: "hi", voteCountGte: 30 }),
        tmdb.getDiscover("tv", { originCountry: "KR", genreId: "9648", withLanguage: "hi", voteCountGte: 20 }),
        tmdb.getDiscover("tv", { originCountry: "KR", genreId: "10759", withLanguage: "hi", voteCountGte: 20 }),
        tmdb.getDiscover("movie", { originalLanguage: "ko", withLanguage: "hi", voteCountGte: 80 }),
    ]);

    return (
        <main className="min-h-screen overflow-x-hidden pb-24 pt-28">
            <div className="mb-8 px-4 sm:px-6 lg:px-10">
                <span className="mb-pulse-glow inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-accent">
                    Korean · Hindi audio
                </span>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
                    <span className="mb-gradient-text">K-Drama</span>
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-400">
                    Every big Korean drama and movie, Hindi-first — stream instantly or download to your phone
                    and watch offline.
                </p>
            </div>

            <div className="space-y-6 md:space-y-12">
                <MovieRow title="Trending K-Drama" movies={trending} />
                <MovieRow title="Highest Rated" movies={topRated} />
                <MovieRow title="Romance & Drama" movies={romance} />
                <MovieRow title="Thriller & Mystery" movies={thriller} />
                <MovieRow title="Action & Adventure" movies={action} />
                <MovieRow title="Korean Movies" movies={kMovies} />
            </div>
        </main>
    );
}
