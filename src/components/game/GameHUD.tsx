import { Star, Crown } from "lucide-react";

interface GameHUDProps {
  score: number;
  combo: number;
  round: number;
  totalNotes: number;
  currentHits: number;
  health: number;
  /** MT3: time-based progress 0-1 */
  songProgress: number;
  onBack: () => void;
  onPause: () => void;
}

// MT3: milestones at fixed progress positions along the song
const MILESTONES = [
  { position: 0.33, type: "star" as const },
  { position: 0.66, type: "star" as const },
  { position: 1.00, type: "crown" as const },
];

const GameHUD = ({ score, combo, round, totalNotes, currentHits, health, songProgress, onBack, onPause }: GameHUDProps) => {
  const progress = Math.min(songProgress, 1);

  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      {/* MT3: Progress bar with stars/crowns at top */}
      <div className="relative mx-auto max-w-md px-3 pt-2">
        <div className="relative h-6 flex items-center">
          {/* Track background */}
          <div className="absolute left-3 right-3 h-[3px] bg-white/20 top-1/2 -translate-y-1/2 rounded-full" />
          {/* Progress fill — yellow */}
          <div
            className="absolute left-3 h-[3px] top-1/2 -translate-y-1/2 rounded-full transition-all duration-300"
            style={{
              width: `${progress * (100 - 6)}%`,
              background: "linear-gradient(90deg, #00f2ff, #ff007a)",
              boxShadow: "0 0 8px rgba(0,242,255,0.55)",
            }}
          />
          {/* Diamond marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-300"
            style={{ left: `${3 + progress * (100 - 6)}%` }}
          >
            <div className="w-2.5 h-2.5 bg-white rotate-45 -translate-x-1/2 shadow-sm" />
          </div>
          {/* Milestone icons */}
          {MILESTONES.map((m, i) => {
            const achieved = progress >= m.position;
            const Icon = m.type === "star" ? Star : Crown;
            return (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${3 + m.position * (100 - 6)}%` }}
              >
                <Icon
                  className={`h-4 w-4 transition-all duration-300 ${
                    achieved ? "scale-110" : "text-white/25"
                  }`}
                  style={
                    achieved
                      ? { color: "#00f2ff", fill: "#00f2ff", filter: "drop-shadow(0 0 6px #00f2ff)" }
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Large centered score — JetBrains Mono for stable width */}
      <div className="flex flex-col items-center mx-auto max-w-md mt-1">
        <span
          className="text-[42px] font-black text-white font-mono-game neon-glow-cyan leading-none"
        >
          {score}
        </span>
        {combo > 1 && (
          <span
            className={`text-sm font-bold font-mono-game mt-0.5 ${
              combo > 25 ? "text-[#ffd700]" : "text-white/80"
            }`}
            style={combo > 25 ? { textShadow: "0 0 10px rgba(255,215,0,0.6)" } : undefined}
          >
            ×{combo}
          </span>
        )}
      </div>

      {/* Pause button */}
      <button
        className="absolute top-2 right-3 pointer-events-auto p-2 rounded-full bg-black/30 active:scale-95 transition-transform"
        onClick={onPause}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2" y="1" width="3.5" height="12" rx="1" fill="white" fillOpacity="0.8" />
          <rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="white" fillOpacity="0.8" />
        </svg>
      </button>
    </div>
  );
};

export default GameHUD;
