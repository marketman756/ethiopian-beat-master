import { memo } from "react";
import { HitEffect, LANES } from "@/lib/gameEngine";

interface HitEffectsProps {
  effects: HitEffect[];
  combo: number;
}

/** Ethiopian flag colors for hit labels */
const HIT_COLORS: Record<string, { color: string; glow: string; border: string }> = {
  PERFECT: { color: "#22c55e", glow: "rgba(34,197,94,0.6)", border: "rgba(34,197,94,0.5)" },   // Green
  GREAT:   { color: "#eab308", glow: "rgba(234,179,8,0.5)",  border: "rgba(234,179,8,0.4)" },   // Yellow/Gold
  COOL:    { color: "#ef4444", glow: "rgba(239,68,68,0.5)",   border: "rgba(239,68,68,0.4)" },   // Red
  NICE:    { color: "rgba(255,255,255,0.6)", glow: "rgba(255,255,255,0.2)", border: "rgba(255,255,255,0.2)" },
};

// Generate particle positions deterministically
const PARTICLES = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  return {
    px: `${Math.cos(angle) * (30 + (i % 3) * 10)}px`,
    py: `${Math.sin(angle) * (30 + (i % 3) * 10)}px`,
  };
});

const HitEffects = memo(({ effects, combo }: HitEffectsProps) => {
  return (
    <>
      {effects.map((effect) => {
        const age = Date.now() - effect.timestamp;
        if (age > 500) return null;

        const style = HIT_COLORS[effect.label] || HIT_COLORS.NICE;

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
            {/* Ripple burst — Ethiopian colored */}
            <div
              className="absolute w-20 h-20 rounded-full"
              style={{
                animation: "ripple-burst 0.4s ease-out forwards",
                border: `2.5px solid ${style.border}`,
                boxShadow: `0 0 20px ${style.glow}`,
              }}
            />
            {/* Particle burst */}
            {PARTICLES.map((p, i) => (
              <div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: style.color,
                  animation: "particle-fly 0.4s ease-out forwards",
                  animationDelay: `${i * 15}ms`,
                  ["--px" as any]: p.px,
                  ["--py" as any]: p.py,
                }}
              />
            ))}
            {/* Hit label */}
            <span
              className="text-xl font-black tracking-tight relative z-10 font-display"
              style={{
                textShadow: `0 0 16px ${style.glow}, 0 2px 8px rgba(0,0,0,0.5)`,
                color: style.color,
              }}
            >
              {effect.label}
            </span>
            {combo > 2 && (
              <span
                className="text-xs font-bold mt-0.5"
                style={{ color: style.color, opacity: 0.8 }}
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
