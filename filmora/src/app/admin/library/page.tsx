"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Entry {
  id: string;
  title: string;
  type: "movie" | "tv";
  season?: number | null;
  episode?: number | null;
  quality: string;
  url: string;
}

const input = "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-orange-500";

export default function LibraryAdminPage() {
  const router = useRouter();
  const [items, setItems] = useState<Entry[]>([]);
  const [msg, setMsg] = useState("");
  const [f, setF] = useState({ title: "", url: "", quality: "720p", type: "movie", season: "", episode: "" });

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/library");
    if (r.status === 401) return router.push("/admin");
    setItems((await r.json()).items ?? []);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json();
    if (!r.ok) return setMsg(d.error ?? "Failed");
    setMsg("Added ✓");
    setF({ ...f, title: "", url: "", season: "", episode: "" });
    load();
  }

  async function del(id: string) {
    await fetch(`/api/admin/library?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Download Library</h1>
        <Link href="/admin/dashboard" className="text-sm text-gray-400 hover:text-white">← Dashboard</Link>
      </div>
      <p className="text-sm text-gray-400">
        Add a movie title and a direct file link (https). The “Download Movie” button on the site will use it.
        Title should match the movie name on the site (e.g. “Inception”).
      </p>
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-white/10 p-4">
        <input className={input} placeholder="Movie / series title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
        <input className={input} placeholder="Direct file URL (https://...mp4)" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} required />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select className={input} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="movie">Movie</option><option value="tv">Series</option>
          </select>
          <select className={input} value={f.quality} onChange={(e) => setF({ ...f, quality: e.target.value })}>
            <option>480p</option><option>720p</option><option>1080p</option>
          </select>
          {f.type === "tv" && (
            <>
              <input className={input} placeholder="Season" value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })} />
              <input className={input} placeholder="Episode" value={f.episode} onChange={(e) => setF({ ...f, episode: e.target.value })} />
            </>
          )}
        </div>
        <button className="rounded-lg bg-orange-500 text-black font-bold py-2">Add to library</button>
        {msg && <p className="text-sm text-gray-300">{msg}</p>}
      </form>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-sm">
            <div className="min-w-0">
              <div className="font-semibold truncate">{i.title}{i.type === "tv" ? ` S${i.season ?? "?"}E${i.episode ?? "?"}` : ""} <span className="text-orange-400">{i.quality}</span></div>
              <div className="text-gray-500 truncate">{i.url}</div>
            </div>
            <button onClick={() => del(i.id)} className="text-red-400 hover:text-red-300">Delete</button>
          </li>
        ))}
        {items.length === 0 && <li className="text-gray-500 text-sm">No files yet.</li>}
      </ul>
    </div>
  );
}
