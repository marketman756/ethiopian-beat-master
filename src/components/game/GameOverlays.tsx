import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play as PlayIcon, RotateCcw, Headphones, Star, Heart } from "lucide-react";
import { ROUND_SPEEDS } from "@/lib/gameEngine";
import { Song } from "@/lib/songs";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CALIBRATION_RANGE,
  getCalibrationOffset,
  setCalibrationOffset,
} from "@/lib/calibration";

// ─── READY OVERLAY (MT3: clean gradient, no tibeb) ───
interface ReadyOverlayProps {
  song: Song;
  loadingProgress: number;
  onStart: () => void;
}

export const ReadyOverlay = ({ song, loadingProgress, onStart }: ReadyOverlayProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0 }}
    transition={{ type: "spring", stiffness: 320, damping: 28 }}
    className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-30 neon-bg-game"
  >
    {/* Soft bokeh lights */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute w-48 h-48 rounded-full blur-[80px] top-[15%] left-[5%] opacity-20"
        style={{ background: "rgba(255,255,255,0.3)" }} />
      <div className="absolute w-56 h-56 rounded-full blur-[80px] bottom-[10%] right-[0%] opacity-15"
        style={{ background: "rgba(255,255,255,0.2)" }} />
      <div className="absolute w-32 h-32 rounded-full blur-[60px] top-[45%] left-[40%] opacity-10"
        style={{ background: "rgba(255,255,255,0.25)" }} />
    </div>

    <div className="relative z-10 flex flex-col items-center gap-5">
      {/* Brand */}
      <span className="text-xs font-display font-bold tracking-[0.3em] uppercase neon-glow-cyan"
        style={{ color: "#00f2ff" }}>
        Ethio-Tiles
      </span>

      {/* Song title */}
      <h2 className="text-3xl font-black text-white drop-shadow-lg tracking-tight text-center px-6 leading-tight">
        {song.title}
      </h2>
      <p className="text-white/50 text-sm font-medium">{song.artist}</p>

      {/* Circular progress */}
      <div className="relative flex items-center justify-center mt-4">
        <svg className="h-32 w-32 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
          <circle
            cx="50" cy="50" r="42" fill="none" strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${Math.min(loadingProgress, 100) * 2.64} 264`}
            className="transition-all duration-300"
            style={{ stroke: "#00f2ff", filter: "drop-shadow(0 0 8px #00f2ff)" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          {loadingProgress >= 100 ? (
            <button
              onClick={(e) => { e.stopPropagation(); onStart(); }}
              className="flex flex-col items-center gap-1 group"
            >
              <PlayIcon className="h-10 w-10 text-white group-hover:scale-110 transition-transform fill-white" />
            </button>
          ) : (
            <>
              <span className="text-white/50 text-xs font-medium">Loading...</span>
              <span className="text-white text-2xl font-black font-mono-game">{Math.min(Math.round(loadingProgress), 100)}%</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-white/40 mt-6">
        <Headphones className="h-5 w-5" />
        <span className="text-sm font-medium">Headphone Recommended</span>
      </div>
    </div>
  </motion.div>
);

// ─── PAUSE OVERLAY (MT3: clean dark blur) ───
interface PauseOverlayProps {
  onResume: () => void;
  onQuit: () => void;
}

export const PauseOverlay = ({ onResume, onQuit }: PauseOverlayProps) => {
  const [offset, setOffset] = useState<number>(() => getCalibrationOffset());

  useEffect(() => {
    setCalibrationOffset(offset);
  }, [offset]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/85 backdrop-blur-md z-30 px-6"
    >
      <span className="text-xs font-display font-bold tracking-[0.3em] uppercase neon-glow-cyan" style={{ color: "#00f2ff" }}>
        Ethio-Tiles
      </span>
      <h2 className="text-2xl font-bold text-white">Paused</h2>

      {/* Audio/visual calibration */}
      <div className="w-full max-w-xs flex flex-col gap-2 bg-white/5 rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-between text-white/80 text-xs font-semibold">
          <span>Audio Offset</span>
          <span className="font-mono-game" style={{ color: offset === 0 ? "rgba(255,255,255,0.6)" : "#00f2ff" }}>
            {offset > 0 ? "+" : ""}{offset} ms
          </span>
        </div>
        <Slider
          value={[offset]}
          min={CALIBRATION_RANGE.min}
          max={CALIBRATION_RANGE.max}
          step={5}
          onValueChange={(v) => setOffset(v[0] ?? 0)}
        />
        <p className="text-[10px] text-white/40 leading-snug">
          If hits feel late, increase. If they feel early, decrease.
        </p>
        {offset !== 0 && (
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="text-[10px] text-white/50 hover:text-white underline self-end"
          >
            Reset to 0
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          onClick={onResume}
          className="gap-2 rounded-full px-6 font-bold active:scale-95 transition-transform"
          style={{
            background: "linear-gradient(135deg, #00f2ff, #0099cc)",
            color: "#0a0118",
            boxShadow: "0 0 18px rgba(0,242,255,0.5)",
          }}
        >
          <PlayIcon className="h-4 w-4" />
          Resume
        </Button>
        <Button variant="outline" onClick={onQuit} className="text-white border-white/30 hover:bg-white/10 rounded-full px-6">
          Quit
        </Button>
      </div>
    </motion.div>
  );
};

// ─── FAIL OVERLAY (MT3: with revive option) ───
interface FailOverlayProps {
  song: Song;
  score: number;
  maxCombo: number;
  round: number;
  canRevive: boolean;
  onRevive: () => void;
  onRetry: () => void;
  onQuit: () => void;
}

export const FailOverlay = ({ song, score, maxCombo, round, canRevive, onRevive, onRetry, onQuit }: FailOverlayProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: "spring", stiffness: 280, damping: 26 }}
    className="absolute inset-0 flex flex-col items-center justify-center z-30"
    style={{ background: "linear-gradient(180deg, rgba(255,0,122,0.55) 0%, rgba(80,0,40,0.95) 50%, rgba(10,1,24,0.98) 100%)" }}
  >
    <div className="relative z-10 flex flex-col items-center gap-4">
      <span className="text-7xl font-black text-white/15 neon-glow-magenta">✕</span>
      <h2 className="text-lg font-semibold text-white/80">{song.title}</h2>
      {round > 0 && (
        <span className="text-xs text-white/50">Round {round + 1} — {ROUND_SPEEDS[round]}x</span>
      )}
      <p className="text-5xl font-black text-white font-mono-game mt-2 neon-glow-cyan">{score}</p>
      <p className="text-white/60 text-sm">Best Combo: {maxCombo}x</p>
      
      <div className="flex flex-col items-center gap-3 mt-6">
        {canRevive && (
          <ReviveButton onRevive={onRevive} />
        )}
        <div className="flex gap-3">
          <Button
            onClick={onRetry}
            size="lg"
            className="gap-2 font-bold rounded-full px-8 shadow-lg active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(135deg, #00f2ff, #0099cc)",
              color: "#0a0118",
              boxShadow: "0 0 18px rgba(0,242,255,0.4)",
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onQuit}
            className="text-white border-white/30 hover:bg-white/10 rounded-full px-8"
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  </motion.div>
);

// ─── REVIVE BUTTON with 5-second countdown ring ───
const REVIVE_TIMEOUT_MS = 5000;
const ReviveButton = ({ onRevive }: { onRevive: () => void }) => {
  const [remaining, setRemaining] = useState(REVIVE_TIMEOUT_MS);
  const startedAt = useRef<number>(performance.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - startedAt.current;
      const left = Math.max(0, REVIVE_TIMEOUT_MS - elapsed);
      setRemaining(left);
      if (left > 0) raf = requestAnimationFrame(tick);
      else expiredRef.current = true;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seconds = Math.ceil(remaining / 1000);
  const fraction = remaining / REVIVE_TIMEOUT_MS;
  const dash = 264 * fraction;

  if (remaining <= 0) {
    return (
      <div className="text-white/40 text-xs italic">Revive expired</div>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onRevive}
      className="relative flex items-center gap-3 rounded-full px-8 py-3 font-bold w-full justify-center"
      style={{
        background: "linear-gradient(135deg, #ff007a, #cc0066)",
        color: "#fff",
        boxShadow: "0 0 24px rgba(255,0,122,0.5)",
      }}
    >
      <svg className="h-9 w-9 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
        <circle
          cx="50" cy="50" r="42" fill="none" strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} 264`}
          stroke="#fff"
          style={{ filter: "drop-shadow(0 0 4px #fff)" }}
        />
      </svg>
      <Heart className="h-4 w-4 fill-white" />
      <span>Revive</span>
      <span className="font-mono-game text-sm opacity-80">{seconds}s</span>
    </motion.button>
  );
};

// ─── ROUND COMPLETE ───
interface RoundCompleteOverlayProps {
  round: number;
  score: number;
  onNextRound: () => void;
}

export const RoundCompleteOverlay = ({ round, score, onNextRound }: RoundCompleteOverlayProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 26 }}
    className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md z-30"
  >
    <div className="relative z-10 flex flex-col items-center gap-4">
      <div className="flex gap-2">
        {Array.from({ length: round + 1 }).map((_, i) => (
          <Star
            key={i}
            className="h-10 w-10 drop-shadow-[0_0_12px_rgba(0,242,255,0.7)]"
            style={{ color: "#00f2ff", fill: "#00f2ff" }}
          />
        ))}
      </div>
      <h2 className="text-xl font-bold text-white mt-2">Round Complete!</h2>
      <p className="text-4xl font-black text-white font-mono-game neon-glow-cyan">{score}</p>
      <p className="text-white/50 text-sm">
        Next: {ROUND_SPEEDS[Math.min(round + 1, ROUND_SPEEDS.length - 1)]}x Speed
      </p>
      <Button
        onClick={onNextRound}
        size="lg"
        className="gap-2 font-bold rounded-full px-8 mt-4 active:scale-95 transition-transform"
        style={{
          background: "linear-gradient(135deg, #00f2ff, #0099cc)",
          color: "#0a0118",
          boxShadow: "0 0 18px rgba(0,242,255,0.5)",
        }}
      >
        Continue
      </Button>
    </div>
  </motion.div>
);

// ─── SONG COMPLETE (MT3: star ratings based on accuracy, clean look) ───
interface SongCompleteOverlayProps {
  song: Song;
  score: number;
  maxCombo: number;
  totalHits: number;
  totalNotes: number;
  onRetry: () => void;
  onQuit: () => void;
}

export const SongCompleteOverlay = ({ song, score, maxCombo, totalHits, totalNotes, onRetry, onQuit }: SongCompleteOverlayProps) => {
  const accuracy = totalNotes > 0 ? Math.round((totalHits / totalNotes) * 100) : 0;
  const stars = accuracy > 95 ? 3 : accuracy > 80 ? 2 : accuracy > 50 ? 1 : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 flex flex-col items-center justify-center z-30 neon-bg-game"
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <span className="text-xs font-display font-bold tracking-[0.3em] uppercase neon-glow-cyan" style={{ color: "#00f2ff" }}>
          Ethio-Tiles
        </span>
        <h2 className="text-lg font-semibold text-white/80">{song.title}</h2>
        <div className="flex gap-3">
          {[1, 2, 3].map((s) => (
            <motion.div
              key={s}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.2 + s * 0.18 }}
            >
              <Star
                className={`h-14 w-14 transition-all duration-500 ${
                  stars >= s ? "drop-shadow-[0_0_16px_rgba(0,242,255,0.8)]" : "text-gray-500/40"
                }`}
                style={stars >= s ? { color: "#00f2ff", fill: "#00f2ff" } : undefined}
              />
            </motion.div>
          ))}
        </div>
        <p className="text-6xl font-black text-white font-mono-game mt-3 neon-glow-cyan">{score}</p>
        <div className="flex gap-6 text-sm text-white/70 mt-1">
          <span>Combo: {maxCombo}x</span>
          <span>Accuracy: {accuracy}%</span>
        </div>
        <div className="flex gap-3 mt-8">
          <Button
            onClick={onRetry}
            size="lg"
            className="gap-2 font-bold rounded-full px-8 shadow-lg active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(135deg, #00f2ff, #0099cc)",
              color: "#0a0118",
              boxShadow: "0 0 18px rgba(0,242,255,0.5)",
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onQuit}
            className="text-white border-white/30 hover:bg-white/10 rounded-full px-8"
          >
            Back
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
