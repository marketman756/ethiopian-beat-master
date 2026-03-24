import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { songs } from "@/lib/songs";
import { getChartForSong, ChartNote } from "@/lib/tileCharts";
import {
  LANES, ROUND_SPEEDS, GamePhase, GameTile, HitEffect,
  getHitLabel, getScoreForHit, playTapSound, playMissSound, triggerVibration,
} from "@/lib/gameEngine";
import GameLanes from "@/components/game/GameLanes";
import HitEffects from "@/components/game/HitEffects";
import GameHUD from "@/components/game/GameHUD";
import {
  ReadyOverlay, PauseOverlay, FailOverlay,
  RoundCompleteOverlay, SongCompleteOverlay,
} from "@/components/game/GameOverlays";

// Hit zone position (percentage from top)
const HIT_ZONE_Y = 80;
const HOLD_HEIGHT_BASE = 18;

/**
 * BPM-aware fall duration: how many ms a tile takes to traverse the screen.
 * Faster BPM = shorter duration = faster perceived speed.
 */
function getFallDurationMs(bpm: number): number {
  // 78 BPM → ~2400ms, 120 BPM → ~1600ms, 130 BPM → ~1500ms
  return Math.max(1200, 3600 - bpm * 16);
}

/**
 * Convert chart time to Y position (percentage from top).
 * Uses the fall duration to determine how far ahead tiles should appear.
 */
function chartTimeToY(noteTime: number, gameTime: number, fallDurationMs: number): number {
  const timeUntilHit = noteTime - gameTime;
  // At timeUntilHit = 0, tile should be at HIT_ZONE_Y
  // At timeUntilHit = fallDurationMs, tile should be at top (0%)
  return HIT_ZONE_Y - (timeUntilHit / fallDurationMs) * HIT_ZONE_Y;
}

// Background color themes that shift during gameplay
const BG_THEMES = [
  "linear-gradient(180deg, #7dd3fc 0%, #3b82f6 50%, #7c3aed 100%)",
  "linear-gradient(180deg, #6ee7b7 0%, #10b981 50%, #14b8a6 100%)",
  "linear-gradient(180deg, #c4b5fd 0%, #8b5cf6 50%, #ec4899 100%)",
  "linear-gradient(180deg, #67e8f9 0%, #0ea5e9 50%, #2563eb 100%)",
];

const Play = () => {
  const { songId } = useParams();
  const navigate = useNavigate();
  const song = songs.find((s) => s.id === songId);
  const chart = songId ? getChartForSong(songId) : undefined;

  // Game state
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const [gamePhase, setGamePhase] = useState<GamePhase>("loading");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [round, setRound] = useState(0);
  const [bgIndex, setBgIndex] = useState(0);

  // Render state — tiles and effects updated per frame
  const [renderTiles, setRenderTiles] = useState<GameTile[]>([]);
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([]);

  // Refs for game loop (no re-renders)
  const tileIdRef = useRef(0);
  const animRef = useRef<number>();
  const lastFrameRef = useRef(0);
  const gameTimeRef = useRef(0);
  const chartIndexRef = useRef(0);
  const holdingLanesRef = useRef<Set<number>>(new Set());
  const tilesRef = useRef<GameTile[]>([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const totalHitsRef = useRef(0);
  const gamePhaseRef = useRef<GamePhase>("loading");
  const lastBgShiftRef = useRef(0);

  // Sync phase ref
  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);

  const speedMultiplier = ROUND_SPEEDS[Math.min(round, ROUND_SPEEDS.length - 1)];
  const fallDurationMs = chart ? getFallDurationMs(chart.bpm) / speedMultiplier : 2000;

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

  // Spawn tiles that should be visible
  const spawnTiles = useCallback((gameTime: number, notes: ChartNote[]) => {
    const newTiles: GameTile[] = [];
    while (chartIndexRef.current < notes.length) {
      const note = notes[chartIndexRef.current];
      const y = chartTimeToY(note.time, gameTime, fallDurationMs);
      if (y > -25) {
        tileIdRef.current++;
        const holdHeight = note.type === "hold" && note.holdDuration
          ? (note.holdDuration / fallDurationMs) * HIT_ZONE_Y + HOLD_HEIGHT_BASE
          : 0;
        const holdEndTime = note.type === "hold" && note.holdDuration
          ? note.time + note.holdDuration
          : undefined;
        newTiles.push({
          id: tileIdRef.current, lane: note.lane, type: note.type,
          lane2: note.lane2, y, holdHeight, hit: false, holding: false,
          holdComplete: false, hit2: false, chartTime: note.time, holdEndTime,
        });
        chartIndexRef.current++;
      } else break;
    }
    return newTiles;
  }, [fallDurationMs]);

  // Main game loop — runs at 60fps via rAF
  const gameLoop = useCallback((timestamp: number) => {
    if (!chart || gamePhaseRef.current !== "playing") return;

    const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16;
    lastFrameRef.current = timestamp;
    gameTimeRef.current += delta * speedMultiplier;
    const gameTime = gameTimeRef.current;

    // Background shift every ~8s
    if (gameTime - lastBgShiftRef.current > 8000) {
      lastBgShiftRef.current = gameTime;
      setBgIndex((i) => i + 1);
    }

    // Update tile positions
    let tiles = tilesRef.current;
    let changed = false;

    tiles = tiles.map((t) => {
      if (t.hit && t.type !== "hold") return t;
      if (t.type === "hold" && t.holdComplete) return t;
      const newY = chartTimeToY(t.chartTime, gameTime, fallDurationMs);

      // Auto-release hold if no longer holding
      if (t.type === "hold" && t.holding && !holdingLanesRef.current.has(t.lane)) {
        changed = true;
        return { ...t, y: newY, holding: false, holdComplete: true, hit: true };
      }
      if (newY !== t.y) changed = true;
      return { ...t, y: newY };
    });

    // Check for missed tiles — instant fail
    const missed = tiles.find((t) => !t.hit && !t.holding && t.y > HIT_ZONE_Y + 8);
    if (missed) {
      playMissSound();
      triggerVibration(100);
      tilesRef.current = tiles;
      setRenderTiles([...tiles]);
      setGamePhase("failed");
      return;
    }

    // Spawn new tiles
    const spawned = spawnTiles(gameTime, chart.notes);
    if (spawned.length > 0) {
      tiles = [...tiles, ...spawned];
      changed = true;
    }

    // Clean up off-screen tiles
    const before = tiles.length;
    tiles = tiles.filter((t) => t.y < 120 && t.y > -30);
    if (tiles.length !== before) changed = true;

    // Check song/round completion
    if (
      chartIndexRef.current >= chart.notes.length &&
      tiles.filter((t) => !t.hit && t.type !== "hold").length === 0 &&
      tiles.filter((t) => t.type === "hold" && !t.holdComplete && !t.hit).length === 0
    ) {
      tilesRef.current = tiles;
      setRenderTiles([...tiles]);
      if (round < ROUND_SPEEDS.length - 1) setGamePhase("round-complete");
      else setGamePhase("song-complete");
      return;
    }

    tilesRef.current = tiles;
    if (changed || spawned.length > 0) {
      setRenderTiles([...tiles]);
    }

    // Clean hit effects
    setHitEffects((prev) => {
      const now = Date.now();
      const filtered = prev.filter((e) => now - e.timestamp < 500);
      return filtered.length !== prev.length ? filtered : prev;
    });

    animRef.current = requestAnimationFrame(gameLoop);
  }, [chart, speedMultiplier, fallDurationMs, spawnTiles, round]);

  // Start/stop game loop
  useEffect(() => {
    if (gamePhase === "playing") {
      lastFrameRef.current = 0;
      animRef.current = requestAnimationFrame(gameLoop);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [gamePhase, gameLoop]);

  // Handle lane tap — ms-based hit detection
  const handleLaneTap = useCallback((lane: number) => {
    if (gamePhaseRef.current !== "playing") return;
    const gameTime = gameTimeRef.current;
    if (gameTime < 500) return; // Grace period

    holdingLanesRef.current.add(lane);

    const tiles = tilesRef.current;
    // Find closest hittable tile in this lane within hit window
    const hittable = tiles
      .filter((t) => {
        if (t.hit || t.holding) return false;
        const inLane = t.lane === lane || (t.type === "double" && t.lane2 === lane);
        if (!inLane) return false;
        const deltaMs = Math.abs(t.chartTime - gameTime);
        return deltaMs <= 200; // NICE window
      })
      .sort((a, b) => Math.abs(a.chartTime - gameTime) - Math.abs(b.chartTime - gameTime));

    if (hittable.length === 0) {
      // Wrong tap — check if tiles are near
      const nearTiles = tiles.filter(
        (t) => !t.hit && Math.abs(t.chartTime - gameTime) < 400
      );
      if (nearTiles.length > 0) {
        playMissSound();
        triggerVibration(100);
        setGamePhase("failed");
      }
      return;
    }

    const target = hittable[0];
    const deltaMs = target.chartTime - gameTime;
    const label = getHitLabel(deltaMs);
    const currentCombo = comboRef.current + 1;
    const scoreGain = getScoreForHit(label, comboRef.current);

    // Update refs immediately (no re-render lag)
    scoreRef.current += scoreGain;
    comboRef.current = currentCombo;
    if (currentCombo > maxComboRef.current) maxComboRef.current = currentCombo;
    totalHitsRef.current++;

    // Audio + haptic feedback
    playTapSound(lane);
    triggerVibration();

    // Update state for UI
    setScore(scoreRef.current);
    setCombo(currentCombo);
    setMaxCombo(maxComboRef.current);
    setTotalHits(totalHitsRef.current);
    setHitEffects((prev) => [...prev, {
      id: target.id, lane, y: target.y, label, timestamp: Date.now(),
    }]);

    // Update tile
    tilesRef.current = tiles.map((t) => {
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
    setRenderTiles([...tilesRef.current]);
  }, []);

  const handleLaneRelease = useCallback((lane: number) => {
    holdingLanesRef.current.delete(lane);
    const tiles = tilesRef.current;
    let updated = false;
    tilesRef.current = tiles.map((t) => {
      if (t.type === "hold" && t.holding && t.lane === lane) {
        const scoreGain = getScoreForHit("GREAT", comboRef.current);
        scoreRef.current += scoreGain;
        setScore(scoreRef.current);
        updated = true;
        return { ...t, holding: false, holdComplete: true, hit: true };
      }
      return t;
    });
    if (updated) setRenderTiles([...tilesRef.current]);
  }, []);

  const resetGame = useCallback(() => {
    tilesRef.current = [];
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    totalHitsRef.current = 0;
    tileIdRef.current = 0;
    chartIndexRef.current = 0;
    gameTimeRef.current = -3000;
    lastBgShiftRef.current = 0;
    holdingLanesRef.current.clear();
    setRenderTiles([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTotalHits(0);
    setHitEffects([]);
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    setRound(0);
    setBgIndex(0);
    setGamePhase("playing");
  }, [resetGame]);

  const startNextRound = useCallback(() => {
    resetGame();
    setRound((r) => r + 1);
    setGamePhase("playing");
  }, [resetGame]);

  if (!song || !chart) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: BG_THEMES[0] }}>
        <p className="text-white/80 text-lg">Song not found.</p>
      </div>
    );
  }

  const bg = BG_THEMES[bgIndex % BG_THEMES.length];

  return (
    <div
      className="flex min-h-[100dvh] flex-col relative overflow-hidden select-none touch-none"
      style={{ background: bg, transition: "background 2s ease" }}
    >
      {/* Geometric overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage: `
            repeating-linear-gradient(45deg, transparent, transparent 60px, rgba(255,255,255,0.12) 60px, rgba(255,255,255,0.12) 61px),
            repeating-linear-gradient(-45deg, transparent, transparent 60px, rgba(255,255,255,0.12) 60px, rgba(255,255,255,0.12) 61px)
          `,
        }}
      />

      {/* Light flares */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[200%] h-[25%] top-[15%] left-[-50%] bg-white/[0.03] rotate-[-12deg] blur-md" />
        <div className="absolute w-[200%] h-[10%] top-[55%] left-[-50%] bg-white/[0.02] rotate-[8deg] blur-md" />
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
        <GameLanes tiles={renderTiles} onLaneTap={handleLaneTap} onLaneRelease={handleLaneRelease} />
        <HitEffects effects={hitEffects} combo={combo} />

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
