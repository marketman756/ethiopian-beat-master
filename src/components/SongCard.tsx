import { Play, Volume2, Crown } from "lucide-react";
import { Song } from "@/lib/songs";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";

const difficultyColors: Record<string, string> = {
  easy: "bg-emerald-500/90 text-white",
  medium: "bg-amber-500/90 text-white",
  hard: "bg-red-500/90 text-white",
};

const genreGradients: Record<string, string> = {
  "Ethio-Jazz": "from-amber-500 via-orange-500 to-red-500",
  Traditional: "from-emerald-500 via-teal-500 to-cyan-500",
  Pop: "from-blue-500 via-indigo-500 to-purple-500",
  Classic: "from-rose-500 via-pink-500 to-purple-500",
  World: "from-violet-500 via-purple-500 to-indigo-500",
};

interface HighScore {
  score: number;
  stars: number;
  maxCombo: number;
  accuracy: number;
}

const SongCard = ({ song, index }: { song: Song; index?: number }) => {
  const navigate = useNavigate();
  const gradient = genreGradients[song.genre] || "from-gray-500 to-gray-600";

  // Read high score from localStorage
  const highScore = useMemo<HighScore | null>(() => {
    try {
      const data = localStorage.getItem(`ethio-tiles-highscore-${song.id}`);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  }, [song.id]);

  return (
    <button
      onClick={() => navigate(`/play/${song.id}`)}
      className="group relative flex overflow-hidden rounded-xl text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-xl"
    >
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />

      {/* Content */}
      <div className="relative flex w-full items-center gap-3 p-3">
        {/* Song number / thumbnail area */}
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-black/20 backdrop-blur-sm">
          {index !== undefined ? (
            <span className="text-2xl font-black text-white/80">{index + 1}</span>
          ) : (
            <div className="text-3xl font-black text-white/30 select-none">♪</div>
          )}
          <Volume2 className="absolute bottom-1 left-1 h-3 w-3 text-white/40" />
        </div>

        {/* Song info */}
        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          <h3 className="font-bold text-white text-sm leading-tight line-clamp-1 drop-shadow-sm">
            {song.title}
          </h3>
          <p className="text-xs text-white/70 line-clamp-1">{song.artist}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-white/50">{song.duration}</span>
            <span className="text-[10px] text-white/50">•</span>
            <span className="text-[10px] text-white/50">{song.bpm} BPM</span>
          </div>
        </div>

        {/* Right side: difficulty + stars + play */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase ${difficultyColors[song.difficulty]}`}>
            {song.difficulty}
          </span>

          {/* Star/Crown rating from high score (MT3-style golden crowns) */}
          {highScore ? (
            <div className="flex gap-0.5">
              {[1, 2, 3].map((s) => (
                <Crown
                  key={s}
                  className={`h-4 w-4 ${
                    highScore.stars >= s
                      ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_3px_rgba(250,204,21,0.6)]"
                      : "text-white/20"
                  }`}
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-0.5">
              {[1, 2, 3].map((s) => (
                <Crown key={s} className="h-4 w-4 text-white/20" />
              ))}
            </div>
          )}

          <div className="flex h-8 w-18 items-center justify-center rounded-md bg-gray-900/60 text-white text-xs font-bold gap-1 group-hover:bg-gray-900/80 transition-colors px-3">
            <Play className="h-3 w-3 fill-white" />
            PLAY
          </div>
        </div>
      </div>
    </button>
  );
};

export default SongCard;
