"use client";

import Link from "next/link";
import { Film, Search, Sparkles } from "lucide-react";
import MovieRow from "@/components/MovieRow";
import type { Movie } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

type AppMoviesExperienceProps = {
  bollywood: Movie[];
  hollywood: Movie[];
  southCinema: Movie[];
  koreanCinema: Movie[];
  anime: Movie[];
};

const cinemaFilters = [
  { label: "Bollywood", href: "#bollywood" },
  { label: "Hollywood", href: "#hollywood" },
  { label: "South Cinema", href: "#south-cinema" },
  { label: "Korean", href: "#korean-cinema" },
  { label: "Anime", href: "#anime" },
];

const appNav = [
  { label: "Home", href: "/" },
  { label: "Movies", href: "/movies", active: true },
  { label: "Web Series", href: "/webseries" },
  { label: "Shorts", href: "/shorts" },
];

const shelves = [
  { id: "bollywood", title: "Bollywood Blockbusters", key: "bollywood" as const, featured: true },
  { id: "hollywood", title: "Trending Hollywood", key: "hollywood" as const },
  { id: "south-cinema", title: "South Powerhouse", key: "southCinema" as const },
  { id: "korean-cinema", title: "K-Cinema Essentials", key: "koreanCinema" as const },
  { id: "anime", title: "Anime Spotlight", key: "anime" as const },
];

export default function AppMoviesExperience(props: AppMoviesExperienceProps) {
  return (
    <div className="app-movies-experience" aria-label="Movies app experience">
      <header className="app-cinema-header">
        <Link href="/" className="app-cinema-brand" aria-label="Movie Box home">
          <span className="app-cinema-mark"><Film aria-hidden="true" /></span>
          <span>MOVIE <b>BOX</b></span>
        </Link>
        <Link href="/search" className="app-cinema-icon" aria-label="Search">
          <Search aria-hidden="true" />
        </Link>
      </header>

      <nav className="app-content-nav" aria-label="Content">
        {appNav.map((item) => (
          <Link key={item.href} href={item.href} className={cn(item.active && "is-active")}>
            {item.label}
          </Link>
        ))}
      </nav>

      <nav className="app-cinema-filters" aria-label="Cinema filters">
        {cinemaFilters.map((filter, index) => (
          <a key={filter.href} href={filter.href} className={cn(index === 0 && "is-active")}>
            {filter.label}
          </a>
        ))}
      </nav>

      <div className="app-cinema-intro">
        <span><Sparkles aria-hidden="true" /> Curated for you</span>
        <h1>Movies</h1>
        <p>Swipe through the best of every cinema.</p>
      </div>

      <div className="app-cinema-shelves">
        {shelves.map((shelf) => (
          <section id={shelf.id} key={shelf.id} className={cn("app-cinema-shelf", shelf.featured && "is-featured")}>
            <MovieRow
              title={shelf.title}
              movies={props[shelf.key]}
              cardClassName="app-cinema-card"
              posterMode
            />
          </section>
        ))}
      </div>

      <div className="app-cinema-home-indicator" aria-hidden="true" />
    </div>
  );
}
