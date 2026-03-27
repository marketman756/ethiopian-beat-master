import { Star, Crown } from "lucide-react";
import { HEALTH } from "@/lib/gameEngine";

interface GameHUDProps {
  score: number;
  combo: number;
  round: number;
  totalNotes: number;
  currentHits: number;
  health: number;
  onBack: () => void;
  onPause: () => void;
}

const MILESTONES = [
  { position: 0.12, type: "star" as const },
  { position: 0.28, type: "star" as const },
  { position: 0.44, type: "star" as const },
  { position: 0.60, type: "crown" as const },
  { position: 0.76, type: "crown" as const },
  { position: 0.92, type: "crown" as const },
];

const MILESTONE_THRESHOLDS = [500, 1500, 3000, 5000, 8000, 12000];

const GameHUD = ({ score, combo, round, totalNotes, currentHits, health, onBack, onPause }: GameHUDProps) => {
  const progress = Math.min(score / 15000, 1);
  const healthPercent = Math.max(0, health / HEALTH.MAX);

  // Health bar color — green > yellow > red (from AutoRhythm)
  const healthColor =
    healthPercent > 0.5 ? "hsl(142, 71%, 45%)" :
    healthPercent > 0.25 ? "hsl(43, 96%, 56%)" :
    "hsl(0, 72%, 51%)";

  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      {/* Health bar — full width at top (from AutoRhythm Board.js) */}
      <div className="relative mx-auto max-w-md px-1 pt-1">
        <div className="relative h-[4px] rounded-full overflow-hidden bg-white/10">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
            style={{
              width: `${healthPercent * 100}%`,
              background: healthColor,
              boxShadow: `0 0 8px ${healthColor}`,
            }}
          />
        </div>
      </div>

      {/* Progress bar with milestones */}
      <div className="relative mx-auto max-w-md px-2 pt-1">
        <div className="relative h-7 flex items-center">
          <div className="absolute left-2 right-2 h-[2px] bg-white/20 top-1/2 -translate-y-1/2" />
          <div
            className="absolute left-2 h-[2px] top-1/2 -translate-y-1/2 transition-all duration-300"
            style={{
              width: `${progress * (100 - 4)}%`,
              background: "linear-gradient(90deg, hsl(48,96%,53%), hsl(43,96%,56%), hsl(48,96%,53%))",
              boxShadow: "0 0 8px rgba(234,179,8,0.4)",
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-300"
            style={{ left: `${2 + progress * (100 - 4)}%` }}
          >
            <div className="w-2 h-2 bg-white rotate-45 -translate-x-1/2 shadow-sm" />
          </div>
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
                  className={`h-3.5 w-3.5 transition-all duration-500 ${
                    achieved
                      ? "drop-shadow-[0_0_6px_rgba(234,179,8,0.8)] scale-125"
                      : "text-white/30"
                  }`}
                  style={achieved ? { color: "hsl(48,96%,53%)", fill: "hsl(48,96%,53%)" } : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Score + Combo */}
      <div className="flex flex-col items-center mx-auto max-w-md -mt-1">
        <span
          className="text-[38px] font-black text-white tabular-nums leading-none font-display"
          style={{ textShadow: "0 2px 16px rgba(234,179,8,0.2), 0 2px 8px rgba(0,0,0,0.3)" }}
        >
          {score}
        </span>
        {combo > 1 && (
          <span
            className="text-xs font-bold tabular-nums mt-0.5"
            style={{
              color: combo >= 50 ? "hsl(48,96%,53%)" : combo >= 20 ? "hsl(142,71%,45%)" : "rgba(255,255,255,0.6)",
              textShadow: combo >= 20 ? "0 0 8px currentColor" : "none",
            }}
          >
            {combo}x COMBO
          </span>
        )}
      </div>

      {/* Pause button */}
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
