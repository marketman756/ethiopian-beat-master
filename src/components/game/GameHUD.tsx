import { Button } from "@/components/ui/button";
import { ArrowLeft, Pause, Star, Crown } from "lucide-react";
import { ROUND_SPEEDS } from "@/lib/gameEngine";

interface GameHUDProps {
  score: number;
  combo: number;
  round: number;
  onBack: () => void;
  onPause: () => void;
}

const MILESTONES = [
  { threshold: 50, type: "star" as const },
  { threshold: 150, type: "star" as const },
  { threshold: 300, type: "star" as const },
  { threshold: 500, type: "crown" as const },
  { threshold: 800, type: "crown" as const },
  { threshold: 1200, type: "crown" as const },
];

const GameHUD = ({ score, combo, round, onBack, onPause }: GameHUDProps) => {
  return (
    <div className="relative z-10">
      {/* Top bar */}
      <div className="flex items-center justify-between px-2 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-white/80 hover:text-white hover:bg-white/10"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Milestones */}
        <div className="flex items-center gap-1">
          {MILESTONES.map((m, i) => {
            const achieved = score >= m.threshold;
            const Icon = m.type === "star" ? Star : Crown;
            return (
              <Icon
                key={i}
                className={`h-4 w-4 transition-all duration-300 ${
                  achieved
                    ? "text-yellow-300 fill-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.6)] scale-110"
                    : "text-white/25"
                }`}
              />
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="text-white/80 hover:text-white hover:bg-white/10"
          onClick={onPause}
        >
          <Pause className="h-5 w-5" />
        </Button>
      </div>

      {/* Score & round indicator */}
      <div className="flex flex-col items-center pb-1">
        <span className="text-4xl font-black text-white drop-shadow-lg tabular-nums">{score}</span>
        <div className="flex items-center gap-2 mt-0.5">
          {round > 0 && (
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              {ROUND_SPEEDS[round]}x Speed
            </span>
          )}
          {combo > 2 && (
            <span className="text-sm font-bold text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
              {combo}x
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameHUD;
