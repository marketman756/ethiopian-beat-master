import { HitEffect } from "@/lib/gameEngine";
import { LANES } from "@/lib/gameEngine";

interface HitEffectsProps {
  effects: HitEffect[];
}

const HitEffects = ({ effects }: HitEffectsProps) => {
  return (
    <>
      {effects.map((effect) => (
        <div
          key={`fx-${effect.id}-${effect.timestamp}`}
          className="absolute flex flex-col items-center justify-center pointer-events-none z-20 animate-hit-feedback"
          style={{
            left: `${(effect.lane / LANES) * 100}%`,
            width: `${100 / LANES}%`,
            top: `${effect.y - 5}%`,
          }}
        >
          <span className={`text-lg font-black drop-shadow-lg ${
            effect.label === "PERFECT"
              ? "text-cyan-300"
              : effect.label === "GREAT"
              ? "text-emerald-300"
              : effect.label === "COOL"
              ? "text-yellow-300"
              : "text-white/80"
          }`}>
            {effect.label}
          </span>
        </div>
      ))}
    </>
  );
};

export default HitEffects;
