import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { songs } from "@/lib/songs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pause, Play as PlayIcon, RotateCcw } from "lucide-react";

interface Tile {
  id: number;
  lane: number;
  y: number;
  hit: boolean;
  missed: boolean;
}

const LANES = 4;
const TILE_SPEED_MAP = { easy: 2.5, medium: 4, hard: 6 };
const SPAWN_INTERVAL_MAP = { easy: 1200, medium: 800, hard: 500 };

const Play = () => {
  const { songId } = useParams();
  const navigate = useNavigate();
  const song = songs.find((s) => s.id === songId);

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [misses, setMisses] = useState(0);
  const [gameState, setGameState] = useState<"ready" | "playing" | "paused" | "ended">("ready");
  const tileIdRef = useRef(0);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef(0);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  const speed = TILE_SPEED_MAP[song?.difficulty || "easy"];
  const spawnInterval = SPAWN_INTERVAL_MAP[song?.difficulty || "easy"];

  const spawnTile = useCallback(() => {
    const lane = Math.floor(Math.random() * LANES);
    tileIdRef.current += 1;
    return { id: tileIdRef.current, lane, y: -15, hit: false, missed: false };
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

        // Check misses
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

  // End after too many misses
  useEffect(() => {
    if (misses >= 10 && gameState === "playing") {
      setGameState("ended");
    }
  }, [misses, gameState]);

  const handleLaneTap = (lane: number) => {
    if (gameState !== "playing") return;

    setTiles((prev) => {
      const hittable = prev.filter(
        (t) => t.lane === lane && !t.hit && !t.missed && t.y >= 60 && t.y <= 100
      );
      if (hittable.length > 0) {
        const target = hittable[0];
        setScore((s) => s + 10 + combo * 2);
        setCombo((c) => {
          const next = c + 1;
          setMaxCombo((m) => Math.max(m, next));
          return next;
        });
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
    tileIdRef.current = 0;
    spawnTimerRef.current = 0;
    setGameState("playing");
  };

  if (!song) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Song not found.</p>
      </div>
    );
  }

  const laneColors = [
    "bg-primary/90",
    "bg-emerald-500/90",
    "bg-amber-500/90",
    "bg-rose-500/90",
  ];

  return (
    <div className="flex min-h-screen flex-col bg-foreground">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold text-primary-foreground">{song.title}</p>
          <p className="text-xs text-primary-foreground/60">{song.artist}</p>
        </div>
        <div className="flex gap-1">
          {gameState === "playing" && (
            <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => setGameState("paused")}>
              <Pause className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Score bar */}
      <div className="flex items-center justify-center gap-6 px-4 pb-2 text-primary-foreground/80 text-sm">
        <span>Score: <strong className="text-primary-foreground">{score}</strong></span>
        <span>Combo: <strong className="text-primary">{combo}x</strong></span>
        <span>Misses: <strong className="text-rose-400">{misses}/10</strong></span>
      </div>

      {/* Game area */}
      <div className="relative flex-1 mx-auto w-full max-w-md overflow-hidden" ref={gameAreaRef}>
        {/* Lane dividers */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: LANES }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-primary-foreground/10 last:border-r-0" />
          ))}
        </div>

        {/* Hit zone indicator */}
        <div className="absolute bottom-[10%] left-0 right-0 h-px bg-primary/40" />

        {/* Tiles */}
        {tiles
          .filter((t) => !t.hit)
          .map((tile) => (
            <div
              key={tile.id}
              className={`absolute rounded-md transition-colors ${
                tile.missed ? "bg-red-500/30" : laneColors[tile.lane]
              }`}
              style={{
                left: `${(tile.lane / LANES) * 100 + 1}%`,
                width: `${100 / LANES - 2}%`,
                top: `${tile.y}%`,
                height: "12%",
              }}
            />
          ))}

        {/* Hit effects */}
        {tiles
          .filter((t) => t.hit)
          .map((tile) => (
            <div
              key={`hit-${tile.id}`}
              className="absolute rounded-md bg-primary/20 animate-ping"
              style={{
                left: `${(tile.lane / LANES) * 100 + 1}%`,
                width: `${100 / LANES - 2}%`,
                top: `${tile.y}%`,
                height: "12%",
                animationDuration: "0.3s",
                animationIterationCount: "1",
              }}
            />
          ))}

        {/* Lane tap buttons */}
        <div className="absolute bottom-0 left-0 right-0 flex h-[25%]">
          {Array.from({ length: LANES }).map((_, i) => (
            <button
              key={i}
              className="flex-1 active:bg-primary-foreground/10 transition-colors"
              onPointerDown={() => handleLaneTap(i)}
            />
          ))}
        </div>

        {/* Overlays */}
        {gameState === "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-foreground/90">
            <h2 className="text-2xl font-bold text-primary-foreground">{song.title}</h2>
            <p className="text-sm text-primary-foreground/60 capitalize">{song.difficulty} difficulty</p>
            <Button onClick={startGame} size="lg" className="gap-2">
              <PlayIcon className="h-5 w-5" />
              Start
            </Button>
          </div>
        )}

        {gameState === "paused" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-foreground/90">
            <h2 className="text-xl font-bold text-primary-foreground">Paused</h2>
            <Button onClick={() => setGameState("playing")} className="gap-2">
              <PlayIcon className="h-4 w-4" />
              Resume
            </Button>
          </div>
        )}

        {gameState === "ended" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-foreground/90">
            <h2 className="text-2xl font-bold text-primary-foreground">Game Over</h2>
            <div className="flex flex-col items-center gap-1 text-primary-foreground/80">
              <p className="text-3xl font-bold text-primary">{score}</p>
              <p className="text-sm">Best Combo: {maxCombo}x</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={startGame} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Retry
              </Button>
              <Button variant="outline" onClick={() => navigate("/library")} className="text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/10">
                Back to Library
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Play;
