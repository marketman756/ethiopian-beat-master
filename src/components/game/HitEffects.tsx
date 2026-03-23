import { HitEffect } from "@/lib/gameEngine";
import { LANES } from "@/lib/gameEngine";

interface HitEffectsProps {
  effects: HitEffect[];
  combo: number;
}

const HitEffects = ({ effects, combo }: HitEffectsProps) => {
  return (
    <>
      {effects.map((effect) => (
        <div
          key={`fx-${effect.id}-${effect.timestamp}`}
          className="absolute flex flex-col items-center justify-center pointer-events-none z-20 animate-hit-feedback"
          style={{
            left: `${(effect.lane / LANES) * 100}%`,
            width: `${100 / LANES}%`,
            top: `${effect.y - 8}%`,
          }}
        >
          {/* Hit label — gradient pink/white like MT3 */}
          <span
            className={`text-xl font-black tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] ${
              effect.label === "PERFECT"
                ? "text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-white to-pink-300"
                : effect.label === "GREAT"
                ? "text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-cyan-300"
                : effect.label === "COOL"
                ? "text-cyan-300"
                : "text-white/70"
            }`}
          >
            {effect.label}
          </span>
          {/* Combo multiplier */}
          {combo > 1 && (
            <span className="text-xs font-bold text-white/60 mt-0.5">
              ×{combo}
            </span>
          )}
        </div>
      ))}
    </>
  );
};

export default HitEffects;
