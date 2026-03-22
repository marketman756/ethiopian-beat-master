import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SongCard from "@/components/SongCard";
import { songs, genres, difficulties } from "@/lib/songs";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10">
        <h1 className="text-3xl font-bold mb-2">Song Library</h1>
        <p className="text-muted-foreground mb-8">Browse and pick a song to play</p>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search songs or artists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border bg-card pl-9 pr-4 text-sm outline-none ring-ring focus:ring-2 transition-shadow"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <Button
                key={g}
                size="sm"
                variant={genre === g ? "default" : "outline"}
                onClick={() => setGenre(g)}
                className="text-xs"
              >
                {g}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {difficulties.map((d) => (
              <Button
                key={d}
                size="sm"
                variant={difficulty === d ? "default" : "outline"}
                onClick={() => setDifficulty(d)}
                className="text-xs capitalize"
              >
                {d}
              </Button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            No songs match your filters. Try adjusting your search.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((song) => (
              <SongCard key={song.id} song={song} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Library;
