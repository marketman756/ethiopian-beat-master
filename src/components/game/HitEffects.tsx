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
              left: "0",
              right: "0",
              top: "45%",
              animation: "hit-feedback 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          >
            {/* MT3: centered PERFECT text in white */}
            <span
              className="text-2xl font-black tracking-wide text-white"
              style={{
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              }}
            >
              {effect.label}
            </span>
            {combo > 2 && (
              <span
                className="text-sm font-bold mt-0.5 text-white/70"
              >
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
