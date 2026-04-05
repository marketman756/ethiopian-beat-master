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
  { position: 0.15, type: "star" as const },
  { position: 0.30, type: "star" as const },
  { position: 0.50, type: "star" as const },
  { position: 0.65, type: "crown" as const },
  { position: 0.80, type: "crown" as const },
  { position: 0.95, type: "crown" as const },
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
              background: "#fbc02d",
              boxShadow: "0 0 6px rgba(251,192,45,0.5)",
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
                  style={achieved ? { color: "#fbc02d", fill: "#fbc02d" } : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* MT3: Large centered score */}
      <div className="flex flex-col items-center mx-auto max-w-md mt-1">
        <span
          className="text-[42px] font-black text-white tabular-nums leading-none"
          style={{ textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
        >
          {score}
        </span>
        {/* MT3: PERFECT ×N combo display */}
        {combo > 1 && (
          <span
            className="text-sm font-bold tabular-nums mt-0.5 text-white/70"
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
