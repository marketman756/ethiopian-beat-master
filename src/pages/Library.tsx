import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SongCard from "@/components/SongCard";
import { songs, genres, difficulties } from "@/lib/songs";
import { Search } from "lucide-react";

const Library = () => {
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const [difficulty, setDifficulty] = useState("All");

  const filtered = songs.filter((s) => {
    const matchSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase());
    const matchGenre = genre === "All" || s.genre === genre;
    const matchDiff = difficulty === "All" || s.difficulty === difficulty;
    return matchSearch && matchGenre && matchDiff;
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #1a0533 0%, #0d0d2b 50%, #0a0a1a 100%)" }}>
      <Navbar variant="dark" />
      <main className="flex-1 container py-8 px-4">
        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search songs or artists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-lg bg-white/10 pl-9 pr-4 text-sm text-white placeholder:text-white/40 outline-none ring-white/20 focus:ring-2 transition-shadow border-0"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setGenre(g)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                genre === g
                  ? "bg-white text-gray-900"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {difficulties.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                difficulty === d
                  ? "bg-white text-gray-900"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Song list */}
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-white/40">
            No songs match your filters.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((song, i) => (
              <SongCard key={song.id} song={song} index={i} />
            ))}
          </div>
        )}
      </main>
      <Footer variant="dark" />
    </div>
  );
};

export default Library;
