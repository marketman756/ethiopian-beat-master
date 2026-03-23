import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { songs } from "@/lib/songs";
import { getChartForSong, ChartNote } from "@/lib/tileCharts";
import {
  LANES, ROUND_SPEEDS, GamePhase, GameTile, HitEffect,
  getHitLabel, getScoreForHit,
} from "@/lib/gameEngine";
import GameLanes from "@/components/game/GameLanes";
import HitEffects from "@/components/game/HitEffects";
import GameHUD from "@/components/game/GameHUD";
import {
  ReadyOverlay, PauseOverlay, FailOverlay,
  RoundCompleteOverlay, SongCompleteOverlay,
} from "@/components/game/GameOverlays";

const BASE_FALL_SPEED = 3.5;
const HIT_ZONE_TOP = 70;
const HIT_ZONE_BOTTOM = 95;
const HOLD_HEIGHT_BASE = 18;

// Background color themes that shift during gameplay — like MT3
const BG_THEMES = [
  { from: "from-sky-300", via: "via-blue-400", to: "to-purple-500" },
  { from: "from-emerald-300", via: "via-green-400", to: "to-teal-500" },
  { from: "from-violet-300", via: "via-purple-400", to: "to-pink-500" },
  { from: "from-cyan-300", via: "via-sky-400", to: "to-blue-500" },
];

const Play = () => {
  const { songId } = useParams();
  const navigate = useNavigate();
  const song = songs.find((s) => s.id === songId);
  const chart = songId ? getChartForSong(songId) : undefined;

  const [tiles, setTiles] = useState<GameTile[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([]);
  const [gamePhase, setGamePhase] = useState<GamePhase>("loading");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [round, setRound] = useState(0);
  const [bgThemeIndex, setBgThemeIndex] = useState(0);

  const tileIdRef = useRef(0);
  const animRef = useRef<number>();
  const lastTimeRef = useRef(0);
  const gameTimeRef = useRef(0);
  const chartIndexRef = useRef(0);
  const holdingLanesRef = useRef<Set<number>>(new Set());
  const tilesRef = useRef<GameTile[]>([]);
  const lastBgShiftRef = useRef(0);

  useEffect(() => { tilesRef.current = tiles; }, [tiles]);

  const speedMultiplier = ROUND_SPEEDS[Math.min(round, ROUND_SPEEDS.length - 1)];
  const currentSpeed = BASE_FALL_SPEED * speedMultiplier;
  const bgTheme = BG_THEMES[bgThemeIndex % BG_THEMES.length];

  // Loading animation
  useEffect(() => {
    if (gamePhase !== "loading") return;
    const interval = setInterval(() => {
      setLoadingProgress((p) => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + Math.random() * 15 + 5;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [gamePhase]);

  useEffect(() => {
    if (loadingProgress >= 100 && gamePhase === "loading") setGamePhase("ready");
  }, [loadingProgress, gamePhase]);

  const chartTimeToY = useCallback((noteTime: number, currentGameTime: number) => {
    const timeDiff = noteTime - currentGameTime;
    const speedPerMs = (currentSpeed * 60) / 1000;
    return HIT_ZONE_TOP - timeDiff * speedPerMs;
  }, [currentSpeed]);

  const spawnUpcomingTiles = useCallback((gameTime: number, notes: ChartNote[]) => {
    const speedPerMs = (currentSpeed * 60) / 1000;
    const newTiles: GameTile[] = [];
    while (chartIndexRef.current < notes.length) {
      const note = notes[chartIndexRef.current];
      const y = chartTimeToY(note.time, gameTime);
      if (y > -20) {
        tileIdRef.current++;
        const holdHeight = note.type === "hold" && note.holdDuration
          ? (note.holdDuration * speedPerMs) + HOLD_HEIGHT_BASE
          : 0;
        newTiles.push({
          id: tileIdRef.current, lane: note.lane, type: note.type,
          lane2: note.lane2, y, holdHeight, hit: false, holding: false,
          holdComplete: false, hit2: false, chartTime: note.time,
        });
        chartIndexRef.current++;
      } else { break; }
    }
    return newTiles;
  }, [currentSpeed, chartTimeToY]);

  // Main game loop
  const gameLoop = useCallback((time: number) => {
    if (!chart) return;
    const delta = lastTimeRef.current ? time - lastTimeRef.current : 16;
    lastTimeRef.current = time;
    gameTimeRef.current += delta * speedMultiplier;
    const gameTime = gameTimeRef.current;

    // Shift background color every ~8 seconds
    if (gameTime - lastBgShiftRef.current > 8000) {
      lastBgShiftRef.current = gameTime;
      setBgThemeIndex((i) => i + 1);
    }

    setTiles((prev) => {
      let updated = prev.map((t) => {
        if (t.hit && t.type !== "hold") return t;
        const newY = chartTimeToY(t.chartTime, gameTime);
        if (t.type === "hold" && t.holding) {
          if (!holdingLanesRef.current.has(t.lane)) {
            return { ...t, y: newY, holding: false, holdComplete: true, hit: true };
          }
        }
        return { ...t, y: newY };
      });

      const missed = updated.find((t) => !t.hit && !t.holding && t.y > HIT_ZONE_BOTTOM + 5);
      if (missed) {
        setGamePhase("failed");
        return updated;
      }

      const spawned = spawnUpcomingTiles(gameTime, chart.notes);
      if (spawned.length > 0) updated = [...updated, ...spawned];
      updated = updated.filter((t) => t.y < 130 && t.y > -30);

      if (
        chartIndexRef.current >= chart.notes.length &&
        updated.filter((t) => !t.hit && t.type !== "hold").length === 0 &&
        updated.filter((t) => t.type === "hold" && !t.holdComplete && !t.hit).length === 0
      ) {
        if (round < ROUND_SPEEDS.length - 1) setGamePhase("round-complete");
        else setGamePhase("song-complete");
        return updated;
      }
      return updated;
    });

    setHitEffects((prev) => prev.filter((e) => Date.now() - e.timestamp < 500));
    animRef.current = requestAnimationFrame(gameLoop);
  }, [chart, speedMultiplier, chartTimeToY, spawnUpcomingTiles, round]);

  useEffect(() => {
    if (gamePhase === "playing") {
      lastTimeRef.current = 0;
      animRef.current = requestAnimationFrame(gameLoop);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [gamePhase, gameLoop]);

  const handleLaneTap = useCallback((lane: number) => {
    if (gamePhase !== "playing") return;
    if (gameTimeRef.current < 500) return;
    holdingLanesRef.current.add(lane);

    setTiles((prev) => {
      const hittable = prev
        .filter((t) => {
          if (t.hit || t.holding) return false;
          const inLane = t.lane === lane || (t.type === "double" && t.lane2 === lane);
          if (!inLane) return false;
          return t.y >= HIT_ZONE_TOP - 15 && t.y <= HIT_ZONE_BOTTOM;
        })
        .sort((a, b) => b.y - a.y);

      if (hittable.length === 0) {
        const tilesNearHitZone = prev.filter(
          (t) => !t.hit && t.y > HIT_ZONE_TOP - 30 && t.y < HIT_ZONE_BOTTOM + 10
        );
        if (tilesNearHitZone.length > 0) setGamePhase("failed");
        return prev;
      }

      const target = hittable[0];
      const accuracy = Math.abs(target.y - 82);
      const label = getHitLabel(accuracy);
      const scoreGain = getScoreForHit(label, combo);

      setScore((s) => s + scoreGain);
      setTotalHits((h) => h + 1);
      setCombo((c) => { const next = c + 1; setMaxCombo((m) => Math.max(m, next)); return next; });
      setHitEffects((prev) => [...prev, { id: target.id, lane, y: target.y, label, timestamp: Date.now() }]);

      return prev.map((t) => {
        if (t.id !== target.id) return t;
        if (t.type === "hold") return { ...t, holding: true };
        if (t.type === "double") {
          const hitPrimary = t.lane === lane ? true : t.hit;
          const hitSecond = t.lane2 === lane ? true : t.hit2;
          if (hitPrimary && hitSecond) return { ...t, hit: true, hit2: true };
          return { ...t, hit: hitPrimary, hit2: hitSecond };
        }
        return { ...t, hit: true };
      });
    });
  }, [gamePhase, combo]);

  const handleLaneRelease = useCallback((lane: number) => {
    holdingLanesRef.current.delete(lane);
    setTiles((prev) =>
      prev.map((t) => {
        if (t.type === "hold" && t.holding && t.lane === lane) {
          const scoreGain = getScoreForHit("GREAT", combo);
          setScore((s) => s + scoreGain);
          return { ...t, holding: false, holdComplete: true, hit: true };
        }
        return t;
      })
    );
  }, [combo]);

  const startGame = useCallback(() => {
    setTiles([]); setScore(0); setCombo(0); setMaxCombo(0); setTotalHits(0);
    setHitEffects([]); setRound(0); setBgThemeIndex(0);
    tileIdRef.current = 0; chartIndexRef.current = 0;
    gameTimeRef.current = -3000; lastBgShiftRef.current = 0;
    holdingLanesRef.current.clear();
    setGamePhase("playing");
  }, []);

  const startNextRound = useCallback(() => {
    setTiles([]); setHitEffects([]);
    setRound((r) => r + 1);
    tileIdRef.current = 0; chartIndexRef.current = 0;
    gameTimeRef.current = -3000; lastBgShiftRef.current = 0;
    holdingLanesRef.current.clear();
    setGamePhase("playing");
  }, []);

  if (!song || !chart) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-400 via-blue-500 to-purple-600">
        <p className="text-white/80">Song not found.</p>
      </div>
    );
  }

  return (
    <div className={`flex min-h-[100dvh] flex-col bg-gradient-to-br ${bgTheme.from} ${bgTheme.via} ${bgTheme.to} relative overflow-hidden select-none touch-none transition-colors duration-[2000ms]`}>
      {/* Crystal/geometric pattern overlay — like MT3 */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%),
            linear-gradient(225deg, rgba(255,255,255,0.3) 0%, transparent 50%),
            repeating-linear-gradient(45deg, transparent, transparent 60px, rgba(255,255,255,0.15) 60px, rgba(255,255,255,0.15) 61px),
            repeating-linear-gradient(-45deg, transparent, transparent 60px, rgba(255,255,255,0.15) 60px, rgba(255,255,255,0.15) 61px)
          `,
        }}
      />

      {/* Light flare effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[200%] h-[30%] top-[20%] left-[-50%] bg-white/[0.04] rotate-[-15deg] blur-sm" />
        <div className="absolute w-[200%] h-[15%] top-[50%] left-[-50%] bg-white/[0.03] rotate-[10deg] blur-sm" />
      </div>

      {/* HUD */}
      {gamePhase === "playing" && (
        <GameHUD
          score={score}
          combo={combo}
          round={round}
          totalNotes={chart.notes.length}
          currentHits={totalHits}
          onBack={() => navigate(-1)}
          onPause={() => setGamePhase("paused")}
        />
      )}

      {/* Game area */}
      <div className="relative flex-1 mx-auto w-full max-w-md overflow-hidden">
        <GameLanes tiles={tiles} onLaneTap={handleLaneTap} onLaneRelease={handleLaneRelease} />
        <HitEffects effects={hitEffects} combo={combo} />

        {/* Overlays */}
        {(gamePhase === "loading" || gamePhase === "ready") && (
          <ReadyOverlay song={song} loadingProgress={loadingProgress} onStart={startGame} />
        )}
        {gamePhase === "paused" && (
          <PauseOverlay onResume={() => setGamePhase("playing")} onQuit={() => navigate("/library")} />
        )}
        {gamePhase === "failed" && (
          <FailOverlay song={song} score={score} maxCombo={maxCombo} round={round} onRetry={startGame} onQuit={() => navigate("/library")} />
        )}
        {gamePhase === "round-complete" && (
          <RoundCompleteOverlay round={round} score={score} onNextRound={startNextRound} />
        )}
        {gamePhase === "song-complete" && (
          <SongCompleteOverlay song={song} score={score} maxCombo={maxCombo} totalHits={totalHits} totalNotes={chart.notes.length} onRetry={startGame} onQuit={() => navigate("/library")} />
        )}
      </div>
    </div>
  );
};

export default Play;
