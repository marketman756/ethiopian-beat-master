import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { songs } from "@/lib/songs";
import { loadChart, getChartForSong, ChartNote, TileChart } from "@/lib/tileCharts";
import {
  GamePhase, GameTile, HitEffect, HEALTH, HIT_WINDOWS,
  getHitLabel, getScoreForHit, getHealthChange, playTapSound, playMissSound,
  triggerVibration, getSpeedMultiplier, STAR_PROGRESS_THRESHOLDS,
  getReleaseLabel, lerp,
} from "@/lib/gameEngine";
import CanvasGame, { CanvasGameHandle } from "@/components/game/CanvasGame";
import GameHUD from "@/components/game/GameHUD";
import {
  ReadyOverlay, PauseOverlay, FailOverlay,
  RoundCompleteOverlay, SongCompleteOverlay,
} from "@/components/game/GameOverlays";
import { useGameAudio } from "@/hooks/useGameAudio";

const HIT_ZONE_Y = 82;        // % of playfield height (matches CanvasRenderer.HIT_ZONE_RATIO)
const HOLD_HEIGHT_BASE = 18;
const LEAD_IN_MS = 3000;
const SPEED_LERP_BEATS = 2;   // beats over which a star-earned speed bump smooths in

function baseFallDurationMs(bpm: number): number {
  return Math.max(1400, 3800 - bpm * 17);
}

function chartTimeToY(noteTime: number, songTimeMs: number, fallDurationMs: number): number {
  const timeUntilHit = noteTime - songTimeMs;
  return HIT_ZONE_Y - (timeUntilHit / fallDurationMs) * HIT_ZONE_Y;
}

const Play = () => {
  const { songId } = useParams();
  const navigate = useNavigate();
  const song = songs.find((s) => s.id === songId);
  const audio = useGameAudio();

  // ── React state (UI-driven only) ──
  const [chart, setChart] = useState<TileChart | null>(() =>
    songId ? getChartForSong(songId) ?? null : null,
  );
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const [health, setHealth] = useState(HEALTH.INITIAL);
  const [gamePhase, setGamePhase] = useState<GamePhase>("loading");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [round, setRound] = useState(0);
  const [songProgress, setSongProgress] = useState(0);
  const [stars, setStars] = useState<0 | 1 | 2 | 3>(0);
  const [canRevive, setCanRevive] = useState(true);

  // ── Refs (game loop hot path) ──
  const tileIdRef = useRef(0);
  const animRef = useRef<number>();
  const chartIndexRef = useRef(0);
  const tilesRef = useRef<GameTile[]>([]);
  const hitEffectsRef = useRef<HitEffect[]>([]);
  const scorePopupsRef = useRef<{ id: number; lane: number; value: number; timestamp: number }[]>([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const totalHitsRef = useRef(0);
  const healthRef = useRef(HEALTH.INITIAL);
  const gamePhaseRef = useRef<GamePhase>("loading");
  const failStateRef = useRef<{ songTimeMs: number; chartIndex: number } | null>(null);

  // Long-press: per-lane → tile being held
  const holdingTileByLaneRef = useRef<Map<number, GameTile>>(new Map());

  // Star/speed system
  const starsRef = useRef<0 | 1 | 2 | 3>(0);
  const currentSpeedRef = useRef(1);
  const targetSpeedRef = useRef(1);
  const speedLerpStartedAtRef = useRef(0);

  // Canvas handle
  const canvasHandleRef = useRef<CanvasGameHandle | null>(null);
  const registerCanvasHandle = useCallback((h: CanvasGameHandle) => {
    canvasHandleRef.current = h;
  }, []);

  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);

  const totalSongDurationMs = chart ? Math.max(...chart.notes.map((n) => n.time), 0) + 5000 : 1;

  // ── Async chart load (JSON beat-map first, procedural fallback) ──
  useEffect(() => {
    if (!songId) return;
    let cancelled = false;
    (async () => {
      const c = await loadChart(songId);
      if (!cancelled && c) setChart(c);
    })();
    return () => { cancelled = true; };
  }, [songId]);

  // ── Load audio ──
  useEffect(() => {
    if (gamePhase !== "loading" || !chart) return;
    let cancelled = false;
    const run = async () => {
      if (chart.audioUrl) {
        const interval = setInterval(() => {
          if (cancelled) return;
          setLoadingProgress((p) => Math.min(p + Math.random() * 10 + 3, 85));
        }, 200);
        await audio.loadAudio(chart.audioUrl);
        clearInterval(interval);
      }
      if (!cancelled) setLoadingProgress(100);
    };
    run();
    return () => { cancelled = true; };
  }, [gamePhase, chart, audio]);

  useEffect(() => {
    if (loadingProgress >= 100 && gamePhase === "loading") {
      const t = setTimeout(() => setGamePhase("ready"), 300);
      return () => clearTimeout(t);
    }
  }, [loadingProgress, gamePhase]);

  // ── Spawning ──
  const spawnTiles = useCallback((songTimeMs: number, notes: ChartNote[], fallDur: number) => {
    while (chartIndexRef.current < notes.length) {
      const note = notes[chartIndexRef.current];
      const y = chartTimeToY(note.time, songTimeMs, fallDur);
      if (y > -30) {
        tileIdRef.current++;
        const holdHeight = note.type === "hold" && note.holdDuration
          ? (note.holdDuration / fallDur) * HIT_ZONE_Y + HOLD_HEIGHT_BASE
          : 0;
        const holdEndTime = note.type === "hold" && note.holdDuration
          ? note.time + note.holdDuration
          : undefined;
        tilesRef.current.push({
          id: tileIdRef.current, lane: note.lane, type: note.type,
          lane2: note.lane2, y, holdHeight, hit: false, holding: false,
          holdComplete: false, hit2: false, chartTime: note.time, holdEndTime,
        });
        chartIndexRef.current++;
      } else break;
    }
  }, []);

  // ── Health change ──
  const applyHealthChange = useCallback((label: string): boolean => {
    const delta = getHealthChange(label);
    healthRef.current = Math.max(0, Math.min(HEALTH.MAX, healthRef.current + delta));
    setHealth(healthRef.current);
    if (healthRef.current <= HEALTH.FAIL_THRESHOLD) {
      playMissSound();
      triggerVibration(100);
      failStateRef.current = {
        songTimeMs: audio.getSongTimeMs(),
        chartIndex: chartIndexRef.current,
      };
      audio.stopPlayback();
      setGamePhase("failed");
      return true;
    }
    return false;
  }, [audio]);

  // ── Effective fall duration with smooth speed lerp ──
  const getEffectiveFallDurationMs = useCallback((bpm: number): number => {
    const base = baseFallDurationMs(bpm);
    const beatMs = 60000 / bpm;
    const lerpMs = SPEED_LERP_BEATS * beatMs;
    const elapsed = performance.now() - speedLerpStartedAtRef.current;
    const t = lerpMs > 0 ? Math.min(1, elapsed / lerpMs) : 1;
    const eff = lerp(currentSpeedRef.current, targetSpeedRef.current, t);
    if (t >= 1) currentSpeedRef.current = targetSpeedRef.current;
    return base / eff;
  }, []);

  // ── Game loop ──
  const gameLoop = useCallback(() => {
    if (!chart || gamePhaseRef.current !== "playing") return;

    const songTimeMs = audio.getSongTimeMs();
    const beatMs = 60000 / chart.bpm;
    const fallDur = getEffectiveFallDurationMs(chart.bpm);

    // Progress + star earning
    const progress = Math.min(1, songTimeMs / totalSongDurationMs);
    setSongProgress(progress);

    let starsNow: 0 | 1 | 2 | 3 = 0;
    for (let i = 0; i < STAR_PROGRESS_THRESHOLDS.length; i++) {
      if (progress >= STAR_PROGRESS_THRESHOLDS[i]) starsNow = (i + 1) as 1 | 2 | 3;
    }
    if (starsNow > starsRef.current) {
      starsRef.current = starsNow;
      setStars(starsNow);
      const nextSpeed = getSpeedMultiplier(starsNow);
      if (nextSpeed !== targetSpeedRef.current) {
        // freeze current lerp position so next lerp starts smoothly
        const prevElapsed = performance.now() - speedLerpStartedAtRef.current;
        const prevT = Math.min(1, prevElapsed / (SPEED_LERP_BEATS * beatMs));
        currentSpeedRef.current = lerp(currentSpeedRef.current, targetSpeedRef.current, prevT);
        targetSpeedRef.current = nextSpeed;
        speedLerpStartedAtRef.current = performance.now();
      }
    }

    // Move + age tiles
    const tiles = tilesRef.current;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (t.hit && t.type !== "hold") continue;
      if (t.type === "hold" && t.holdComplete) continue;
      t.y = chartTimeToY(t.chartTime, songTimeMs, fallDur);
    }

    // Miss detection
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (t.hit || t.holding) continue;
      if (t.y > HIT_ZONE_Y + 20) {
        t.hit = true;
        comboRef.current = 0;
        setCombo(0);
        if (applyHealthChange("MISS")) return;
      }
    }

    spawnTiles(songTimeMs, chart.notes, fallDur);

    // GC
    const now = performance.now();
    tilesRef.current = tiles.filter((t) => t.y < 120 && t.y > -40);
    hitEffectsRef.current = hitEffectsRef.current.filter((e) => now - e.timestamp < 500);
    scorePopupsRef.current = scorePopupsRef.current.filter((p) => now - p.timestamp < 600);

    const beatPhase = (songTimeMs % beatMs) / beatMs;
    const tileHeightFrac = ((beatMs / fallDur) * HIT_ZONE_Y + 2) / 100;

    canvasHandleRef.current?.setRenderState({
      tiles: tilesRef.current,
      hitEffects: hitEffectsRef.current,
      scorePopups: scorePopupsRef.current,
      combo: comboRef.current,
      beatPhase,
      tileHeightFrac,
      starsEarned: starsRef.current,
    });

    // Song complete?
    if (
      chartIndexRef.current >= chart.notes.length &&
      tilesRef.current.filter((t) => !t.hit && t.type !== "hold").length === 0 &&
      tilesRef.current.filter((t) => t.type === "hold" && !t.holdComplete && !t.hit).length === 0
    ) {
      audio.stopPlayback();
      setGamePhase("song-complete");
      return;
    }

    animRef.current = requestAnimationFrame(gameLoop);
  }, [chart, audio, applyHealthChange, getEffectiveFallDurationMs, spawnTiles, totalSongDurationMs]);

  useEffect(() => {
    if (gamePhase === "playing") {
      animRef.current = requestAnimationFrame(gameLoop);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [gamePhase, gameLoop]);

  // ── Tap input ──
  const handleLaneTap = useCallback((lane: number) => {
    if (gamePhaseRef.current !== "playing") return;
    const songTimeMs = audio.getSongTimeMs();

    const tiles = tilesRef.current;
    let bestTile: GameTile | null = null;
    let bestAbs = Infinity;

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (t.hit && t.type !== "double") continue;
      if (t.type === "hold" && t.holding) continue;
      const inLane =
        t.lane === lane ||
        (t.type === "double" && t.lane2 === lane && !t.hit2);
      if (!inLane) continue;
      const abs = Math.abs(t.chartTime - songTimeMs);
      if (abs <= HIT_WINDOWS.MAX_REGISTRABLE && abs < bestAbs) {
        bestAbs = abs;
        bestTile = t;
      }
    }

    if (!bestTile) return;
    const target = bestTile;
    const deltaMs = target.chartTime - songTimeMs;
    const label = getHitLabel(deltaMs);
    const newCombo = comboRef.current + 1;
    const scoreGain = getScoreForHit(label, comboRef.current);

    scoreRef.current += scoreGain;
    comboRef.current = newCombo;
    if (newCombo > maxComboRef.current) maxComboRef.current = newCombo;
    totalHitsRef.current++;

    applyHealthChange(label);
    playTapSound(lane);
    triggerVibration();
    canvasHandleRef.current?.flashLane(lane);

    // Apply hit
    if (target.type === "hold") {
      target.holding = true;
      holdingTileByLaneRef.current.set(target.lane, target);
    } else if (target.type === "double") {
      const hitPrimary = target.lane === lane;
      const hitSecond = target.lane2 === lane;
      if (hitSecond) target.hit2 = true;
      // Tile considered fully hit when both lanes registered
      const primaryDone = target.hit || hitPrimary;
      const secondDone = target.hit2;
      target.hit = primaryDone && secondDone;
    } else {
      target.hit = true;
    }

    setScore(scoreRef.current);
    setCombo(newCombo);
    setMaxCombo(maxComboRef.current);
    setTotalHits(totalHitsRef.current);

    const now = performance.now();
    hitEffectsRef.current.push({ id: target.id, lane, y: target.y, label, timestamp: now });
    scorePopupsRef.current.push({ id: target.id, lane, value: scoreGain, timestamp: now });
  }, [audio, applyHealthChange]);

  // ── Release input — true long-press scoring ──
  const handleLaneRelease = useCallback((lane: number) => {
    const held = holdingTileByLaneRef.current.get(lane);
    if (!held) return;
    holdingTileByLaneRef.current.delete(lane);

    const songTimeMs = audio.getSongTimeMs();
    const intendedEnd = held.holdEndTime ?? held.chartTime;
    const deltaMs = songTimeMs - intendedEnd;
    const release = getReleaseLabel(deltaMs);

    if (release === "EARLY" && deltaMs < 0) {
      // Released too early → break combo
      comboRef.current = 0;
      setCombo(0);
      held.holding = false;
      held.hit = true;
      held.holdComplete = true;
      hitEffectsRef.current.push({
        id: held.id, lane, y: held.y, label: "MISS", timestamp: performance.now(),
      });
      return;
    }

    const label = release === "PERFECT" ? "PERFECT" : "GREAT";
    const gain = getScoreForHit(label, comboRef.current);
    scoreRef.current += gain;
    comboRef.current += 1;
    if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;

    held.holding = false;
    held.hit = true;
    held.holdComplete = true;

    setScore(scoreRef.current);
    setCombo(comboRef.current);
    setMaxCombo(maxComboRef.current);

    const now = performance.now();
    hitEffectsRef.current.push({ id: held.id, lane, y: held.y, label, timestamp: now });
    scorePopupsRef.current.push({ id: held.id, lane, value: gain, timestamp: now });
  }, [audio]);

  // ── Reset / start ──
  const resetGame = useCallback(() => {
    tilesRef.current = [];
    hitEffectsRef.current = [];
    scorePopupsRef.current = [];
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    totalHitsRef.current = 0;
    healthRef.current = HEALTH.INITIAL;
    tileIdRef.current = 0;
    chartIndexRef.current = 0;
    holdingTileByLaneRef.current.clear();
    failStateRef.current = null;
    starsRef.current = 0;
    currentSpeedRef.current = 1;
    targetSpeedRef.current = 1;
    speedLerpStartedAtRef.current = performance.now();
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTotalHits(0);
    setHealth(HEALTH.INITIAL);
    setSongProgress(0);
    setStars(0);
    audio.stopPlayback();
  }, [audio]);

  const startGame = useCallback(() => {
    resetGame();
    setRound(0);
    setCanRevive(true);
    audio.startPlayback(LEAD_IN_MS, 1);
    setGamePhase("playing");
  }, [resetGame, audio]);

  const handleRevive = useCallback(() => {
    if (!failStateRef.current) return;
    healthRef.current = HEALTH.MAX;
    setHealth(HEALTH.MAX);
    comboRef.current = 0;
    setCombo(0);
    setCanRevive(false);
    tilesRef.current = tilesRef.current.filter((t) => !t.hit || t.type === "hold");
    audio.startPlayback(0, 1);
    setGamePhase("playing");
  }, [audio]);

  const startNextRound = useCallback(() => {
    const nextRound = round + 1;
    resetGame();
    setRound(nextRound);
    audio.startPlayback(LEAD_IN_MS, 1);
    setGamePhase("playing");
  }, [resetGame, round, audio]);

  if (!song || !chart) {
    return (
      <div className="flex min-h-screen items-center justify-center neon-bg-game">
        <p className="text-white/80 text-lg">Loading song...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col relative overflow-hidden select-none touch-none neon-bg-game">
      {gamePhase === "playing" && (
        <GameHUD
          score={score}
          combo={combo}
          round={round}
          totalNotes={chart.notes.length}
          currentHits={totalHits}
          health={health}
          songProgress={songProgress}
          onBack={() => navigate(-1)}
          onPause={() => {
            setGamePhase("paused");
            audio.pausePlayback();
          }}
        />
      )}

      <motion.div
        layout
        className="relative flex-1 mx-auto w-full max-w-md overflow-hidden neon-border"
      >
        <CanvasGame
          active={gamePhase === "playing"}
          onLaneTap={handleLaneTap}
          onLaneRelease={handleLaneRelease}
          registerHandle={registerCanvasHandle}
        />

        {(gamePhase === "loading" || gamePhase === "ready") && (
          <ReadyOverlay song={song} loadingProgress={loadingProgress} onStart={startGame} />
        )}
        {gamePhase === "paused" && (
          <PauseOverlay
            onResume={() => {
              setGamePhase("playing");
              audio.resumePlayback();
            }}
            onQuit={() => navigate("/library")}
          />
        )}
        {gamePhase === "failed" && (
          <FailOverlay
            song={song}
            score={score}
            maxCombo={maxCombo}
            round={round}
            canRevive={canRevive}
            onRevive={handleRevive}
            onRetry={startGame}
            onQuit={() => navigate("/library")}
          />
        )}
        {gamePhase === "round-complete" && (
          <RoundCompleteOverlay round={round} score={score} onNextRound={startNextRound} />
        )}
        {gamePhase === "song-complete" && (
          <SongCompleteOverlay
            song={song}
            score={score}
            maxCombo={maxCombo}
            totalHits={totalHits}
            totalNotes={chart.notes.length}
            onRetry={startGame}
            onQuit={() => navigate("/library")}
          />
        )}
      </motion.div>

      <div className="sr-only" aria-live="polite">{stars} stars earned</div>
    </div>
  );
};

export default Play;