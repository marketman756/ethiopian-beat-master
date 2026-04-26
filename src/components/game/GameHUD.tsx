import { Star, Crown } from "lucide-react";

interface GameHUDProps {
  score: number;
  combo: number;
  round: number;
  totalNotes: number;
  currentHits: number;
  health: number;
  songProgress: number;
  onBack: () => void;
  onPause: () => void;
}

// MT3: progress bar milestones (stars then crowns)
// Observed pattern: ★ ★ ★ 👑 👑 👑 across the bar
const MILESTONES = [
  { position: 0.15, type: "star" as const },
  { position: 0.30, type: "star" as const },
  { position: 0.45, type: "star" as const },
  { position: 0.60, type: "crown" as const },
  { position: 0.75, type: "crown" as const },
  { position: 0.90, type: "crown" as const },
];

const GameHUD = ({ score, combo, songProgress, onPause }: GameHUDProps) => {
  const progress = Math.min(songProgress, 1);

  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      {/* MT3: Progress bar with stars/crowns at top */}
      <div className="relative mx-auto max-w-md px-3 pt-2">
        <div className="relative h-7 flex items-center">
          {/* Track background line */}
          <div className="absolute left-3 right-3 h-[2.5px] bg-white/25 top-1/2 -translate-y-1/2 rounded-full" />

          {/* Progress fill — golden yellow (MT3-accurate) */}
          <div
            className="absolute left-3 h-[2.5px] top-1/2 -translate-y-1/2 rounded-full transition-all duration-300"
            style={{
              width: `${progress * (100 - 6)}%`,
              background: "#ffc800",
              boxShadow: "0 0 6px rgba(255,200,0,0.5)",
            }}
          />

          {/* Play position triangle ▷ */}
          <div
            className="absolute top-1/2 transition-all duration-300"
            style={{ left: `calc(3% + ${progress * 94}%)`, transform: "translate(-50%, -50%)" }}
          >
            <svg width="8" height="10" viewBox="0 0 8 10" fill="white" opacity="0.7">
              <polygon points="0,0 8,5 0,10" />
            </svg>
          </div>

          {/* Milestone icons: stars then crowns */}
          {MILESTONES.map((m, i) => {
            const achieved = progress >= m.position;
            const Icon = m.type === "star" ? Star : Crown;
            return (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${3 + m.position * 94}%` }}
              >
                <Icon
                  className={`h-4 w-4 transition-all duration-500 ${
                    achieved ? "scale-110" : "text-white/30"
                  }`}
                  style={
                    achieved
                      ? { color: "#ffc800", fill: "#ffc800", filter: "drop-shadow(0 0 4px rgba(255,200,0,0.7))" }
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>

        {/* Small dots below milestones (MT3 decoration) */}
        <div className="relative h-3">
          {MILESTONES.map((m, i) => (
            <div
              key={i}
              className="absolute -translate-x-1/2"
              style={{ left: `${3 + m.position * 94}%`, top: 0 }}
            >
              <div className={`w-1 h-1 rounded-full ${progress >= m.position ? "bg-white/60" : "bg-white/15"}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Score: large centered white text (matches MT3 video) */}
      <div className="flex flex-col items-center mx-auto max-w-md -mt-1">
        <span className="text-[38px] font-black text-white font-mono-game leading-none"
          style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
        >
          {score}
        </span>
      </div>

      {/* Pause button (top right, semi-transparent) */}
      <button
        className="absolute top-2 right-3 pointer-events-auto p-2 rounded-full bg-black/20 active:scale-95 transition-transform"
        onClick={onPause}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2" y="1" width="3.5" height="12" rx="1" fill="white" fillOpacity="0.6" />
          <rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="white" fillOpacity="0.6" />
        </svg>
      </button>
    </div>
  );
};

export default GameHUD;
