import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 60);

  const movies = (await tmdb.getUpcoming())
    .filter((movie) => {
      if (!movie.release_date) return false;
      const release = new Date(`${movie.release_date}T00:00:00Z`);
      return release >= now && release <= end;
    })
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 20)
    .map((movie) => ({
      id: movie.id,
      title: movie.title ?? movie.name ?? "Upcoming movie",
      releaseDate: movie.release_date ?? null,
      poster: movie.poster_path
        ? `${tmdbImageBase}/w342${movie.poster_path}`
        : null,
    }));

  return NextResponse.json(
    { movies, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600" } },
  );
}

const tmdbImageBase = "https://image.tmdb.org/t/p";
