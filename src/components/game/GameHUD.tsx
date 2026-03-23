import { Star, Crown } from "lucide-react";
import { ROUND_SPEEDS } from "@/lib/gameEngine";

interface GameHUDProps {
  score: number;
  combo: number;
  round: number;
  totalNotes: number;
  currentHits: number;
  onBack: () => void;
  onPause: () => void;
}

// 3 stars + 3 crowns = 6 milestones across the progress bar
const MILESTONES = [
  { position: 0.12, type: "star" as const },
  { position: 0.28, type: "star" as const },
  { position: 0.44, type: "star" as const },
  { position: 0.60, type: "crown" as const },
  { position: 0.76, type: "crown" as const },
  { position: 0.92, type: "crown" as const },
];

const MILESTONE_THRESHOLDS = [50, 150, 300, 500, 800, 1200];

const GameHUD = ({ score, combo, round, totalNotes, currentHits, onBack, onPause }: GameHUDProps) => {
  // Progress based on score relative to max possible
  const progress = Math.min(score / 1500, 1);

  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      {/* Progress bar with milestones — Magic Tiles 3 style */}
      <div className="relative mx-auto max-w-md px-2 pt-2">
        {/* The progress line */}
        <div className="relative h-8 flex items-center">
          {/* Background line */}
          <div className="absolute left-2 right-2 h-[2px] bg-white/20 top-1/2 -translate-y-1/2" />
          {/* Filled line */}
          <div
            className="absolute left-2 h-[2px] bg-yellow-400 top-1/2 -translate-y-1/2 transition-all duration-300"
            style={{ width: `${progress * (100 - 4)}%` }}
          />

          {/* Current position indicator — small triangle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-300"
            style={{ left: `${2 + progress * (100 - 4)}%` }}
          >
            <div className="w-2 h-2 bg-white rotate-45 -translate-x-1/2 shadow-sm" />
          </div>

          {/* Milestone icons */}
          {MILESTONES.map((m, i) => {
            const achieved = score >= MILESTONE_THRESHOLDS[i];
            const Icon = m.type === "star" ? Star : Crown;
            return (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${2 + m.position * (100 - 4)}%` }}
              >
                <Icon
                  className={`h-4 w-4 transition-all duration-500 ${
                    achieved
                      ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.8)] scale-125"
                      : "text-white/30"
                  }`}
                />
                {/* Small dot on the line */}
                {!achieved && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/40" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Score + combo — centered below progress bar */}
      <div className="flex flex-col items-center mx-auto max-w-md -mt-1">
        <span className="text-[42px] font-black text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.3)] tabular-nums leading-none">
          {score}
        </span>
      </div>

      {/* Pause button — top right, small */}
      <button
        className="absolute top-2 right-3 pointer-events-auto p-1.5 rounded-full bg-black/20 active:scale-95 transition-transform"
        onClick={onPause}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2" y="1" width="3.5" height="12" rx="1" fill="white" fillOpacity="0.7" />
          <rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="white" fillOpacity="0.7" />
        </svg>
      </button>
    </div>
  );
};

export default GameHUD;
