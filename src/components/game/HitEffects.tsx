import { memo } from "react";
import { HitEffect, LANES } from "@/lib/gameEngine";

interface HitEffectsProps {
  effects: HitEffect[];
  combo: number;
}

const HitEffects = memo(({ effects, combo }: HitEffectsProps) => {
  return (
    <>
      {effects.map((effect) => {
        const age = Date.now() - effect.timestamp;
        if (age > 500) return null;

        return (
          <div
            key={`fx-${effect.id}-${effect.timestamp}`}
            className="absolute flex flex-col items-center justify-center pointer-events-none z-20"
            style={{
              left: `${(effect.lane / LANES) * 100}%`,
              width: `${100 / LANES}%`,
              top: `${effect.y - 8}%`,
              animation: "hit-feedback 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          >
            {/* Ripple burst */}
            <div
              className="absolute w-16 h-16 rounded-full"
              style={{
                animation: "ripple-burst 0.4s ease-out forwards",
                border: effect.label === "PERFECT"
                  ? "2px solid rgba(236,72,153,0.6)"
                  : "2px solid rgba(34,211,238,0.4)",
              }}
            />
            {/* Hit label */}
            <span
              className="text-xl font-black tracking-tight relative z-10"
              style={{
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
                color: effect.label === "PERFECT" ? "#f472b6"
                     : effect.label === "GREAT" ? "#22d3ee"
                     : effect.label === "COOL" ? "#a5f3fc"
                     : "rgba(255,255,255,0.7)",
              }}
            >
              {effect.label}
            </span>
            {combo > 2 && (
              <span className="text-xs font-bold text-white/60 mt-0.5">
                ×{combo}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
});

HitEffects.displayName = "HitEffects";

export default HitEffects;
