import { Button } from "@/components/ui/button";
import { Play as PlayIcon, RotateCcw, Headphones, Star } from "lucide-react";
import { ROUND_SPEEDS } from "@/lib/gameEngine";
import { Song } from "@/lib/songs";

interface ReadyOverlayProps {
  song: Song;
  loadingProgress: number;
  onStart: () => void;
}

export const ReadyOverlay = ({ song, loadingProgress, onStart }: ReadyOverlayProps) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-sky-400 via-blue-500 to-purple-600 z-30">
    {/* Decorative blurs */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute w-48 h-48 rounded-full bg-cyan-300/20 blur-[80px] top-[15%] left-[5%]" />
      <div className="absolute w-56 h-56 rounded-full bg-pink-400/15 blur-[80px] bottom-[10%] right-[0%]" />
      <div className="absolute w-32 h-32 rounded-full bg-white/10 blur-[60px] top-[45%] left-[40%]" />
    </div>

    <div className="relative z-10 flex flex-col items-center gap-5">
      {/* Song title */}
      <h2 className="text-3xl font-black text-white drop-shadow-lg tracking-tight text-center px-6 leading-tight">
        {song.title}
      </h2>
      <p className="text-white/60 text-sm font-medium">{song.artist}</p>

      {/* Circular progress */}
      <div className="relative flex items-center justify-center mt-4">
        <svg className="h-32 w-32 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
          <circle
            cx="50" cy="50" r="42" fill="none" stroke="white" strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${Math.min(loadingProgress, 100) * 2.64} 264`}
            className="transition-all duration-300"
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
              <span className="text-white/60 text-xs font-medium">Loading...</span>
              <span className="text-white text-2xl font-black">{Math.min(Math.round(loadingProgress), 100)}%</span>
            </>
          )}
        </div>
      </div>

      {/* Headphones */}
      <div className="flex items-center gap-2 text-white/50 mt-6">
        <Headphones className="h-5 w-5" />
        <span className="text-sm font-medium">Headphone Recommended</span>
      </div>
    </div>
  </div>
);

interface PauseOverlayProps {
  onResume: () => void;
  onQuit: () => void;
}

export const PauseOverlay = ({ onResume, onQuit }: PauseOverlayProps) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/70 backdrop-blur-sm z-30">
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

interface FailOverlayProps {
  song: Song;
  score: number;
  maxCombo: number;
  round: number;
  onRetry: () => void;
  onQuit: () => void;
}

export const FailOverlay = ({ song, score, maxCombo, round, onRetry, onQuit }: FailOverlayProps) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-red-500/90 via-red-700/95 to-gray-950/95 backdrop-blur-sm z-30">
    <div className="flex flex-col items-center gap-4">
      <span className="text-7xl font-black text-white/15">✕</span>
      <h2 className="text-lg font-semibold text-white/80">{song.title}</h2>
      {round > 0 && (
        <span className="text-xs text-white/50">Round {round + 1} — {ROUND_SPEEDS[round]}x</span>
      )}
      <p className="text-5xl font-black text-white tabular-nums mt-2 drop-shadow-lg">{score}</p>
      <p className="text-white/60 text-sm">Best Combo: {maxCombo}x</p>
      <div className="flex gap-3 mt-6">
        <Button
          onClick={onRetry}
          size="lg"
          className="gap-2 bg-white text-gray-900 hover:bg-white/90 font-bold rounded-full px-8 shadow-lg active:scale-95 transition-transform"
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

interface RoundCompleteOverlayProps {
  round: number;
  score: number;
  onNextRound: () => void;
}

export const RoundCompleteOverlay = ({ round, score, onNextRound }: RoundCompleteOverlayProps) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-30">
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-2">
        {Array.from({ length: round + 1 }).map((_, i) => (
          <Star key={i} className="h-10 w-10 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.7)]" />
        ))}
      </div>
      <h2 className="text-xl font-bold text-white mt-2">Round Complete!</h2>
      <p className="text-4xl font-black text-white tabular-nums">{score}</p>
      <p className="text-white/50 text-sm">
        Next: {ROUND_SPEEDS[Math.min(round + 1, ROUND_SPEEDS.length - 1)]}x Speed
      </p>
      <Button
        onClick={onNextRound}
        size="lg"
        className="gap-2 bg-white text-gray-900 hover:bg-white/90 font-bold rounded-full px-8 mt-4 active:scale-95 transition-transform"
      >
        Continue
      </Button>
    </div>
  </div>
);

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
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-500/90 via-purple-600/90 to-pink-500/90 backdrop-blur-sm z-30">
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-lg font-semibold text-white/80">{song.title}</h2>
        <div className="flex gap-3">
          {[1, 2, 3].map((s) => (
            <Star
              key={s}
              className={`h-14 w-14 transition-all duration-500 ${
                stars >= s
                  ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_16px_rgba(250,204,21,0.8)]"
                  : "text-gray-500/40"
              }`}
              style={{ transitionDelay: `${s * 200}ms` }}
            />
          ))}
        </div>
        <p className="text-6xl font-black text-white tabular-nums mt-3 drop-shadow-lg">{score}</p>
        <div className="flex gap-6 text-sm text-white/60 mt-1">
          <span>Combo: {maxCombo}x</span>
          <span>Accuracy: {accuracy}%</span>
        </div>
        <div className="flex gap-3 mt-8">
          <Button
            onClick={onRetry}
            size="lg"
            className="gap-2 bg-white text-gray-900 hover:bg-white/90 font-bold rounded-full px-8 shadow-lg active:scale-95 transition-transform"
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
