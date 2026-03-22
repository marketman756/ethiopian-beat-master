import { Play } from "lucide-react";
import { Song } from "@/lib/songs";
import { useNavigate } from "react-router-dom";

const difficultyColors = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
};

const genreGradients: Record<string, string> = {
  "Ethio-Jazz": "from-amber-400 to-orange-500",
  Traditional: "from-emerald-400 to-teal-500",
  Pop: "from-primary to-blue-400",
  Classic: "from-rose-400 to-pink-500",
  World: "from-violet-400 to-purple-500",
};

const SongCard = ({ song }: { song: Song }) => {
  const navigate = useNavigate();
  const gradient = genreGradients[song.genre] || "from-gray-400 to-gray-500";

  return (
    <button
      onClick={() => navigate(`/play/${song.id}`)}
      className="group relative flex flex-col overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <div className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${gradient}`}>
        <div className="text-4xl font-black text-white/20 select-none">♪</div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-lg">
            <Play className="h-5 w-5 text-foreground ml-0.5" />
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="font-semibold leading-tight line-clamp-1">{song.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-1">{song.artist}</p>
        <div className="mt-auto flex items-center gap-2 pt-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColors[song.difficulty]}`}>
            {song.difficulty}
          </span>
          <span className="text-xs text-muted-foreground">{song.duration}</span>
        </div>
      </div>
    </button>
  );
};

export default SongCard;
