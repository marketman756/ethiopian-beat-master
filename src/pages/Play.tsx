import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { songs } from "@/lib/songs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pause, Play as PlayIcon, RotateCcw, Headphones, Star, Crown } from "lucide-react";

interface Tile {
  id: number;
  lane: number;
  y: number;
  hit: boolean;
  missed: boolean;
}

interface HitEffect {
  id: number;
  lane: number;
  y: number;
  label: string;
  timestamp: number;
}

const LANES = 4;
const TILE_SPEED_MAP = { easy: 2.5, medium: 4, hard: 6 };
const SPAWN_INTERVAL_MAP = { easy: 1200, medium: 800, hard: 500 };

const HIT_LABELS = ["PERFECT", "COOL", "GREAT", "NICE"];

const Play = () => {
  const { songId } = useParams();
  const navigate = useNavigate();
  const song = songs.find((s) => s.id === songId);

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [misses, setMisses] = useState(0);
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([]);
  const [gameState, setGameState] = useState<"ready" | "playing" | "paused" | "ended">("ready");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const tileIdRef = useRef(0);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef(0);

  const speed = TILE_SPEED_MAP[song?.difficulty || "easy"];
  const spawnInterval = SPAWN_INTERVAL_MAP[song?.difficulty || "easy"];

  // Fake loading animation
  useEffect(() => {
    if (gameState !== "ready") return;
    const interval = setInterval(() => {
      setLoadingProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + Math.random() * 15 + 5;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [gameState]);

  const spawnTile = useCallback(() => {
    const lane = Math.floor(Math.random() * LANES);
    tileIdRef.current += 1;
    return { id: tileIdRef.current, lane, y: -20, hit: false, missed: false };
  }, []);

  const gameLoop = useCallback(
    (time: number) => {
      if (gameState !== "playing") return;
      const delta = lastTimeRef.current ? (time - lastTimeRef.current) / 16 : 1;
      lastTimeRef.current = time;
      spawnTimerRef.current += delta * 16;

      setTiles((prev) => {
        let newTiles = prev.map((t) => ({
          ...t,
          y: t.hit ? t.y : t.y + speed * delta,
        }));

        const missed = newTiles.filter((t) => !t.hit && !t.missed && t.y > 105);
        if (missed.length > 0) {
          setMisses((m) => m + missed.length);
          setCombo(0);
        }

        newTiles = newTiles
          .map((t) => (t.y > 105 && !t.hit ? { ...t, missed: true } : t))
          .filter((t) => t.y < 120);

        if (spawnTimerRef.current >= spawnInterval) {
          spawnTimerRef.current = 0;
          newTiles.push(spawnTile());
        }
        return newTiles;
      });

      // Clean old hit effects
      setHitEffects((prev) => prev.filter((e) => Date.now() - e.timestamp < 600));

      animationRef.current = requestAnimationFrame(gameLoop);
    },
    [gameState, speed, spawnInterval, spawnTile]
  );

  useEffect(() => {
    if (gameState === "playing") {
      lastTimeRef.current = 0;
      animationRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameState, gameLoop]);

  useEffect(() => {
    if (misses >= 10 && gameState === "playing") {
      setGameState("ended");
    }
  }, [misses, gameState]);

  const handleLaneTap = (lane: number) => {
    if (gameState !== "playing") return;
    setTiles((prev) => {
      const hittable = prev.filter(
        (t) => t.lane === lane && !t.hit && !t.missed && t.y >= 55 && t.y <= 100
      );
      if (hittable.length > 0) {
        const target = hittable[0];
        const accuracy = Math.abs(target.y - 80);
        const label = accuracy < 8 ? "PERFECT" : accuracy < 15 ? "GREAT" : accuracy < 22 ? "COOL" : "NICE";
        setScore((s) => s + 10 + combo * 2);
        setTotalHits((h) => h + 1);
        setCombo((c) => {
          const next = c + 1;
          setMaxCombo((m) => Math.max(m, next));
          return next;
        });
        setHitEffects((prev) => [
          ...prev,
          { id: target.id, lane: target.lane, y: target.y, label, timestamp: Date.now() },
        ]);
        return prev.map((t) => (t.id === target.id ? { ...t, hit: true } : t));
      }
      return prev;
    });
  };

  const startGame = () => {
    setTiles([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setMisses(0);
    setTotalHits(0);
    setHitEffects([]);
    tileIdRef.current = 0;
    spawnTimerRef.current = 0;
    setGameState("playing");
  };

  if (!song) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-400 via-blue-500 to-purple-600">
        <p className="text-white/80">Song not found.</p>
      </div>
    );
  }

  // Star rating based on performance
  const getStars = () => {
    if (totalHits === 0) return 0;
    const ratio = totalHits / (totalHits + misses);
    if (ratio > 0.9) return 3;
    if (ratio > 0.7) return 2;
    if (ratio > 0.4) return 1;
    return 0;
  };

  // Progress milestones (stars + crowns like reference)
  const milestones = [
    { threshold: 50, type: "star" },
    { threshold: 150, type: "star" },
    { threshold: 300, type: "star" },
    { threshold: 500, type: "crown" },
    { threshold: 800, type: "crown" },
    { threshold: 1200, type: "crown" },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-br from-sky-300 via-blue-400 to-purple-500 relative overflow-hidden">
      {/* Decorative diamond pattern overlay */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.3) 40px, rgba(255,255,255,0.3) 42px),
            repeating-linear-gradient(-45deg, transparent, transparent 40px, rgba(255,255,255,0.3) 40px, rgba(255,255,255,0.3) 42px)`,
        }}
      />

      {/* Progress bar at top */}
      {gameState === "playing" && (
        <div className="relative z-10 flex items-center justify-between px-2 py-2">
          <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-1">
            {milestones.map((m, i) => {
              const achieved = score >= m.threshold;
              return (
                <div key={i} className={`transition-all duration-300 ${achieved ? "scale-110" : "scale-100"}`}>
                  {m.type === "star" ? (
                    <Star className={`h-5 w-5 ${achieved ? "text-yellow-300 fill-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.6)]" : "text-white/30"}`} />
                  ) : (
                    <Crown className={`h-5 w-5 ${achieved ? "text-yellow-300 fill-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.6)]" : "text-white/30"}`} />
                  )}
                </div>
              );
            })}
          </div>
          <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10" onClick={() => setGameState("paused")}>
            <Pause className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Score + combo display during play */}
      {gameState === "playing" && (
        <div className="relative z-10 flex items-center justify-center pb-1">
          <span className="text-4xl font-black text-white drop-shadow-lg tabular-nums">{score}</span>
        </div>
      )}

      {/* Game area */}
      <div className="relative flex-1 mx-auto w-full max-w-md overflow-hidden">
        {/* Lane dividers */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: LANES }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-white/15 last:border-r-0" />
          ))}
        </div>

        {/* Bottom glow zone */}
        <div className="absolute bottom-0 left-0 right-0 h-[15%] bg-gradient-to-t from-purple-600/30 to-transparent pointer-events-none" />

        {/* Tiles — BLACK like Magic Tiles */}
        {tiles
          .filter((t) => !t.hit)
          .map((tile) => (
            <div
              key={tile.id}
              className={`absolute rounded-sm shadow-lg ${
                tile.missed
                  ? "bg-red-500/50 border border-red-400/30"
                  : "bg-gray-900 border border-gray-700/50"
              }`}
              style={{
                left: `${(tile.lane / LANES) * 100 + 0.8}%`,
                width: `${100 / LANES - 1.6}%`,
                top: `${tile.y}%`,
                height: "14%",
              }}
            />
          ))}

        {/* Hit feedback text effects */}
        {hitEffects.map((effect) => (
          <div
            key={`effect-${effect.id}`}
            className="absolute flex flex-col items-center justify-center pointer-events-none z-20 animate-hit-feedback"
            style={{
              left: `${(effect.lane / LANES) * 100}%`,
              width: `${100 / LANES}%`,
              top: `${effect.y - 5}%`,
            }}
          >
            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-white drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">
              {effect.label}
            </span>
          </div>
        ))}

        {/* Combo display in center */}
        {gameState === "playing" && combo > 2 && (
          <div className="absolute top-[15%] left-0 right-0 flex justify-center pointer-events-none z-10">
            <span className="text-sm font-bold text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
              {combo}x COMBO
            </span>
          </div>
        )}

        {/* Lane tap buttons */}
        <div className="absolute bottom-0 left-0 right-0 flex h-[30%]">
          {Array.from({ length: LANES }).map((_, i) => (
            <button
              key={i}
              className="flex-1 active:bg-white/15 transition-colors duration-75"
              onPointerDown={() => handleLaneTap(i)}
            />
          ))}
        </div>

        {/* READY / LOADING overlay */}
        {gameState === "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-sky-400 via-blue-500 to-purple-600 z-30">
            {/* Decorative bokeh */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute w-32 h-32 rounded-full bg-cyan-300/20 blur-3xl top-[10%] left-[10%]" />
              <div className="absolute w-40 h-40 rounded-full bg-pink-400/15 blur-3xl top-[50%] right-[5%]" />
              <div className="absolute w-24 h-24 rounded-full bg-blue-300/20 blur-2xl bottom-[20%] left-[30%]" />
            </div>

            <div className="relative z-10 flex flex-col items-center gap-6">
              <h2 className="text-3xl font-black text-white drop-shadow-lg tracking-tight text-center px-4 leading-tight">
                {song.title}
              </h2>
              <p className="text-white/60 text-sm">{song.artist}</p>
              <p className="text-white/40 text-xs uppercase tracking-widest">{song.difficulty} difficulty</p>

              {/* Loading circle */}
              <div className="relative flex items-center justify-center">
                <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                  <circle
                    cx="50" cy="50" r="42" fill="none" stroke="white" strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.min(loadingProgress, 100) * 2.64} 264`}
                    className="transition-all duration-300"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  {loadingProgress >= 100 ? (
                    <button onClick={startGame} className="flex flex-col items-center gap-1 group">
                      <PlayIcon className="h-8 w-8 text-white group-hover:scale-110 transition-transform" />
                      <span className="text-xs text-white/80 font-medium">TAP</span>
                    </button>
                  ) : (
                    <>
                      <span className="text-white/80 text-xs">Loading...</span>
                      <span className="text-white text-lg font-bold">{Math.min(Math.round(loadingProgress), 100)}%</span>
                    </>
                  )}
                </div>
              </div>

              {/* Headphone rec */}
              <div className="flex items-center gap-2 text-white/50">
                <Headphones className="h-5 w-5" />
                <span className="text-sm font-medium">Headphones Recommended</span>
              </div>
            </div>
          </div>
        )}

        {/* PAUSED overlay */}
        {gameState === "paused" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/70 backdrop-blur-sm z-30">
            <h2 className="text-2xl font-bold text-white">Paused</h2>
            <div className="flex gap-3">
              <Button onClick={() => setGameState("playing")} className="gap-2 bg-white text-gray-900 hover:bg-white/90">
                <PlayIcon className="h-4 w-4" />
                Resume
              </Button>
              <Button variant="outline" onClick={() => navigate("/library")} className="text-white border-white/30 hover:bg-white/10">
                Quit
              </Button>
            </div>
          </div>
        )}

        {/* GAME OVER overlay */}
        {gameState === "ended" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-500/90 via-purple-500/90 to-pink-500/90 backdrop-blur-sm z-30">
            <div className="flex flex-col items-center gap-4">
              <h2 className="text-lg font-semibold text-white/80">{song.title}</h2>

              {/* Stars */}
              <div className="flex gap-2">
                {[1, 2, 3].map((s) => (
                  <Star
                    key={s}
                    className={`h-12 w-12 transition-all duration-500 ${
                      getStars() >= s
                        ? "text-yellow-300 fill-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,0.7)]"
                        : "text-gray-500/60"
                    }`}
                    style={{ transitionDelay: `${s * 150}ms` }}
                  />
                ))}
              </div>

              {/* Score */}
              <p className="text-5xl font-black text-white tabular-nums mt-2">{score}</p>
              <p className="text-white/60 text-sm">Best Combo: {maxCombo}x</p>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={startGame}
                  size="lg"
                  className="gap-2 bg-white text-gray-900 hover:bg-white/90 font-bold rounded-full px-8 shadow-lg"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retry
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate("/library")}
                  className="text-white border-white/30 hover:bg-white/10 rounded-full px-8"
                >
                  Back
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Misses indicator at bottom */}
      {gameState === "playing" && (
        <div className="relative z-10 flex items-center justify-center py-2 gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-4 rounded-full transition-colors ${
                i < misses ? "bg-red-400" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Play;
