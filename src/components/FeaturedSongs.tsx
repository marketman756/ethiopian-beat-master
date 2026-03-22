import { songs } from "@/lib/songs";
import SongCard from "./SongCard";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const FeaturedSongs = () => {
  const ref = useScrollReveal();

  const featured = songs.filter((s) => s.popular).slice(0, 6);

  return (
    <section ref={ref} className="container py-20 opacity-0">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Featured Songs</h2>
          <p className="mt-1 text-muted-foreground">Popular tracks loved by the community</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((song, i) => (
          <div key={song.id} style={{ animationDelay: `${i * 80}ms` }}>
            <SongCard song={song} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeaturedSongs;
