import { Button } from "@/components/ui/button";
import { Play as PlayIcon, RotateCcw, Headphones, Star, Heart } from "lucide-react";
import { ROUND_SPEEDS } from "@/lib/gameEngine";
import { Song } from "@/lib/songs";

// ─── READY OVERLAY (MT3: clean gradient, no tibeb) ───
interface ReadyOverlayProps {
  song: Song;
  loadingProgress: number;
  onStart: () => void;
}

export const ReadyOverlay = ({ song, loadingProgress, onStart }: ReadyOverlayProps) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-30"
    style={{
      background: "linear-gradient(180deg, #1a237e 0%, #283593 40%, #3949ab 100%)",
    }}
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
      <span className="text-xs font-display font-bold tracking-[0.3em] uppercase"
        style={{ color: "#fbc02d" }}>
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
            style={{ stroke: "#fbc02d" }}
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
              <span className="text-white text-2xl font-black font-display">{Math.min(Math.round(loadingProgress), 100)}%</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-white/40 mt-6">
        <Headphones className="h-5 w-5" />
        <span className="text-sm font-medium">Headphone Recommended</span>
      </div>
    </div>
  </div>
);

// ─── PAUSE OVERLAY (MT3: clean dark blur) ───
interface PauseOverlayProps {
  onResume: () => void;
  onQuit: () => void;
}

export const PauseOverlay = ({ onResume, onQuit }: PauseOverlayProps) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/80 backdrop-blur-sm z-30">
    <span className="text-xs font-display font-bold tracking-[0.3em] uppercase" style={{ color: "#fbc02d" }}>
      Ethio-Tiles
    </span>
    <h2 className="text-2xl font-bold text-white">Paused</h2>
    <div className="flex gap-3">
      <Button onClick={onResume} className="gap-2 bg-white text-gray-900 hover:bg-white/90 rounded-full px-6 font-bold active:scale-95 transition-transform">
        <PlayIcon className="h-4 w-4" />
        Resume
      </Button>
      <Button variant="outline" onClick={onQuit} className="text-white border-white/30 hover:bg-white/10 rounded-full px-6">
        Quit
      </Button>
    </div>
  </div>
);

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
  <div className="absolute inset-0 flex flex-col items-center justify-center z-30"
    style={{ background: "linear-gradient(180deg, rgba(220,38,38,0.85) 0%, rgba(127,29,29,0.95) 50%, rgba(10,10,20,0.98) 100%)" }}
  >
    <div className="relative z-10 flex flex-col items-center gap-4">
      <span className="text-7xl font-black text-white/15">✕</span>
      <h2 className="text-lg font-semibold text-white/80">{song.title}</h2>
      {round > 0 && (
        <span className="text-xs text-white/50">Round {round + 1} — {ROUND_SPEEDS[round]}x</span>
      )}
      <p className="text-5xl font-black text-white tabular-nums mt-2 drop-shadow-lg font-display">{score}</p>
      <p className="text-white/60 text-sm">Best Combo: {maxCombo}x</p>
      
      <div className="flex flex-col items-center gap-3 mt-6">
        {/* MT3: Free Revive button — continue from where you failed */}
        {canRevive && (
          <Button
            onClick={onRevive}
            size="lg"
            className="gap-2 font-bold rounded-full px-8 shadow-lg active:scale-95 transition-transform w-full"
            style={{ background: "linear-gradient(135deg, #fbc02d, #f9a825)", color: "#1a1a2e" }}
          >
            <Heart className="h-4 w-4" />
            Free Revive
          </Button>
        )}
        <div className="flex gap-3">
          <Button
            onClick={onRetry}
            size="lg"
            className="gap-2 font-bold rounded-full px-8 shadow-lg active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "white" }}
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
  </div>
);

// ─── ROUND COMPLETE ───
interface RoundCompleteOverlayProps {
  round: number;
  score: number;
  onNextRound: () => void;
}

export const RoundCompleteOverlay = ({ round, score, onNextRound }: RoundCompleteOverlayProps) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-30">
    <div className="relative z-10 flex flex-col items-center gap-4">
      <div className="flex gap-2">
        {Array.from({ length: round + 1 }).map((_, i) => (
          <Star
            key={i}
            className="h-10 w-10 drop-shadow-[0_0_12px_rgba(251,192,45,0.7)]"
            style={{ color: "#fbc02d", fill: "#fbc02d" }}
          />
        ))}
      </div>
      <h2 className="text-xl font-bold text-white mt-2">Round Complete!</h2>
      <p className="text-4xl font-black text-white tabular-nums font-display">{score}</p>
      <p className="text-white/50 text-sm">
        Next: {ROUND_SPEEDS[Math.min(round + 1, ROUND_SPEEDS.length - 1)]}x Speed
      </p>
      <Button
        onClick={onNextRound}
        size="lg"
        className="gap-2 font-bold rounded-full px-8 mt-4 active:scale-95 transition-transform"
        style={{ background: "linear-gradient(135deg, #fbc02d, #f9a825)", color: "#1a1a2e" }}
      >
        Continue
      </Button>
    </div>
  </div>
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
    <div className="absolute inset-0 flex flex-col items-center justify-center z-30"
      style={{
        background: "linear-gradient(180deg, #1a237e 0%, #283593 40%, #1b5e20 70%, #f57f17 100%)",
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <span className="text-xs font-display font-bold tracking-[0.3em] uppercase" style={{ color: "#fbc02d" }}>
          Ethio-Tiles
        </span>
        <h2 className="text-lg font-semibold text-white/80">{song.title}</h2>
        <div className="flex gap-3">
          {[1, 2, 3].map((s) => (
            <Star
              key={s}
              className={`h-14 w-14 transition-all duration-500 ${
                stars >= s ? "drop-shadow-[0_0_16px_rgba(251,192,45,0.8)]" : "text-gray-500/40"
              }`}
              style={stars >= s ? { color: "#fbc02d", fill: "#fbc02d" } : undefined}
            />
          ))}
        </div>
        <p className="text-6xl font-black text-white tabular-nums mt-3 drop-shadow-lg font-display">{score}</p>
        <div className="flex gap-6 text-sm text-white/70 mt-1">
          <span>Combo: {maxCombo}x</span>
          <span>Accuracy: {accuracy}%</span>
        </div>
        <div className="flex gap-3 mt-8">
          <Button
            onClick={onRetry}
            size="lg"
            className="gap-2 font-bold rounded-full px-8 shadow-lg active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg, #fbc02d, #f9a825)", color: "#1a1a2e" }}
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
  );
};
