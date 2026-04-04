import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { songs } from "@/lib/songs";
import { getChartForSong, ChartNote } from "@/lib/tileCharts";
import {
  LANES, ROUND_SPEEDS, GamePhase, GameTile, HitEffect, HEALTH,
  getHitLabel, getScoreForHit, getHealthChange, playTapSound, playMissSound,
  triggerVibration, KEYBOARD_LANE_MAP,
} from "@/lib/gameEngine";
import GameLanes from "@/components/game/GameLanes";
import HitEffects from "@/components/game/HitEffects";
import GameHUD from "@/components/game/GameHUD";
import {
  ReadyOverlay, PauseOverlay, FailOverlay,
  RoundCompleteOverlay, SongCompleteOverlay,
} from "@/components/game/GameOverlays";
import { useGameAudio } from "@/hooks/useGameAudio";

const HIT_ZONE_Y = 82;
const HOLD_HEIGHT_BASE = 18;
const LEAD_IN_MS = 3000;

function getFallDurationMs(bpm: number): number {
  return Math.max(1400, 3800 - bpm * 17);
}

function chartTimeToY(noteTime: number, songTimeMs: number, fallDurationMs: number): number {
  const timeUntilHit = noteTime - songTimeMs;
  return HIT_ZONE_Y - (timeUntilHit / fallDurationMs) * HIT_ZONE_Y;
}

// Magic Tiles 3 style: Blue → Green → Yellow cycling backgrounds
const STAGE_THEMES = [
  { bg: "linear-gradient(180deg, #0a1628 0%, #0d2847 40%, #1a3a6e 100%)", accent: "rgba(59,130,246,0.12)" },   // Blue
  { bg: "linear-gradient(180deg, #0a1e12 0%, #0d3a1f 40%, #1a5e2e 100%)", accent: "rgba(34,197,94,0.12)" },    // Green
  { bg: "linear-gradient(180deg, #1e1a08 0%, #3a2f0d 40%, #5e4a1a 100%)", accent: "rgba(234,179,8,0.12)" },    // Yellow
  { bg: "linear-gradient(180deg, #0a1628 0%, #0d2847 40%, #1a3a6e 100%)", accent: "rgba(59,130,246,0.12)" },   // Blue again
  { bg: "linear-gradient(180deg, #0a1e12 0%, #0d3a1f 40%, #1a5e2e 100%)", accent: "rgba(34,197,94,0.12)" },    // Green again
  { bg: "linear-gradient(180deg, #1e1a08 0%, #3a2f0d 40%, #5e4a1a 100%)", accent: "rgba(234,179,8,0.12)" },    // Yellow again
];

const Play = () => {
  const { songId } = useParams();
  const navigate = useNavigate();
  const song = songs.find((s) => s.id === songId);
  const chart = songId ? getChartForSong(songId) : undefined;
  const audio = useGameAudio();

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const [health, setHealth] = useState(HEALTH.INITIAL);
  const [gamePhase, setGamePhase] = useState<GamePhase>("loading");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [round, setRound] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [beatFlash, setBeatFlash] = useState(false);

  const [renderTiles, setRenderTiles] = useState<GameTile[]>([]);
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([]);

  const tileIdRef = useRef(0);
  const animRef = useRef<number>();
  const chartIndexRef = useRef(0);
  const holdingLanesRef = useRef<Set<number>>(new Set());
  const tilesRef = useRef<GameTile[]>([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const totalHitsRef = useRef(0);
  const healthRef = useRef(HEALTH.INITIAL);
  const gamePhaseRef = useRef<GamePhase>("loading");
  const beatCountRef = useRef(0);

  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);

  const speedMultiplier = ROUND_SPEEDS[Math.min(round, ROUND_SPEEDS.length - 1)];
  const fallDurationMs = chart ? getFallDurationMs(chart.bpm) / speedMultiplier : 2000;

  // Loading
  useEffect(() => {
    if (gamePhase !== "loading" || !chart) return;
    let cancelled = false;
    const doLoad = async () => {
      if (chart.audioUrl) {
        const progressInterval = setInterval(() => {
          if (cancelled) return;
          setLoadingProgress((p) => Math.min(p + Math.random() * 10 + 3, 85));
        }, 200);
        await audio.loadAudio(chart.audioUrl);
        clearInterval(progressInterval);
      }
      if (!cancelled) setLoadingProgress(100);
    };
    doLoad();
    return () => { cancelled = true; };
  }, [gamePhase, chart, audio]);

  useEffect(() => {
    if (loadingProgress >= 100 && gamePhase === "loading") {
      const t = setTimeout(() => setGamePhase("ready"), 300);
      return () => clearTimeout(t);
    }
  }, [loadingProgress, gamePhase]);

  // Spawn tiles
  const spawnTiles = useCallback((songTimeMs: number, notes: ChartNote[]) => {
    const newTiles: GameTile[] = [];
    while (chartIndexRef.current < notes.length) {
      const note = notes[chartIndexRef.current];
      const y = chartTimeToY(note.time, songTimeMs, fallDurationMs);
      if (y > -30) {
        tileIdRef.current++;
        const holdHeight = note.type === "hold" && note.holdDuration
          ? (note.holdDuration / fallDurationMs) * HIT_ZONE_Y + HOLD_HEIGHT_BASE : 0;
        const holdEndTime = note.type === "hold" && note.holdDuration
          ? note.time + note.holdDuration : undefined;
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

  // ─── HEALTH CHANGE (from AutoRhythm) ───
  const applyHealthChange = useCallback((label: string) => {
    const delta = getHealthChange(label);
    healthRef.current = Math.max(0, Math.min(HEALTH.MAX, healthRef.current + delta));
    setHealth(healthRef.current);

    // Game over only when health hits 0
    if (healthRef.current <= HEALTH.FAIL_THRESHOLD) {
      playMissSound();
      triggerVibration(100);
      audio.stopPlayback();
      setGamePhase("failed");
      return true;
    }
    return false;
  }, [audio]);

  // Game loop
  const gameLoop = useCallback(() => {
    if (!chart || gamePhaseRef.current !== "playing") return;

    const songTimeMs = audio.getSongTimeMs();
    const beatMs = 60000 / chart.bpm;

    // Stage progression every 32 bars (128 beats)
    const currentBeat = Math.floor(songTimeMs / beatMs);
    if (currentBeat > 0 && currentBeat % 128 === 0 && currentBeat !== beatCountRef.current) {
      beatCountRef.current = currentBeat;
      setStageIndex((i) => i + 1);
    }

    // Beat-drop flash every 4 beats
    if (currentBeat > 0 && currentBeat % 4 === 0 && Math.floor(songTimeMs / beatMs) !== Math.floor((songTimeMs - 16) / beatMs)) {
      setBeatFlash(true);
      setTimeout(() => setBeatFlash(false), 120);
    }

    let tiles = tilesRef.current;
    let changed = false;

    tiles = tiles.map((t) => {
      if (t.hit && t.type !== "hold") return t;
      if (t.type === "hold" && t.holdComplete) return t;
      const newY = chartTimeToY(t.chartTime, songTimeMs, fallDurationMs);
      if (t.type === "hold" && t.holding && !holdingLanesRef.current.has(t.lane)) {
        changed = true;
        return { ...t, y: newY, holding: false, holdComplete: true, hit: true };
      }
      if (newY !== t.y) changed = true;
      return { ...t, y: newY };
    });

    // ─── MISS DETECTION (AutoRhythm style: drain health, don't instant fail) ───
    const missedTiles = tiles.filter((t) => !t.hit && !t.holding && t.y > HIT_ZONE_Y + 20);
    if (missedTiles.length > 0) {
      for (const missed of missedTiles) {
        missed.hit = true; // Mark as processed
        comboRef.current = 0; // Reset combo on miss (AutoRhythm pattern)
        setCombo(0);
        const failed = applyHealthChange("MISS");
        if (failed) {
          tilesRef.current = tiles;
          setRenderTiles([...tiles]);
          return; // Stop loop on game over
        }
      }
      changed = true;
    }

    const spawned = spawnTiles(songTimeMs, chart.notes);
    if (spawned.length > 0) {
      tiles = [...tiles, ...spawned];
      changed = true;
    }

    const before = tiles.length;
    tiles = tiles.filter((t) => t.y < 120 && t.y > -40);
    if (tiles.length !== before) changed = true;

    if (
      chartIndexRef.current >= chart.notes.length &&
      tiles.filter((t) => !t.hit && t.type !== "hold").length === 0 &&
      tiles.filter((t) => t.type === "hold" && !t.holdComplete && !t.hit).length === 0
    ) {
      audio.stopPlayback();
      tilesRef.current = tiles;
      setRenderTiles([...tiles]);
      if (round < ROUND_SPEEDS.length - 1) setGamePhase("round-complete");
      else setGamePhase("song-complete");
      return;
    }

    tilesRef.current = tiles;
    if (changed || spawned.length > 0) setRenderTiles([...tiles]);

    setHitEffects((prev) => {
      const now = Date.now();
      const filtered = prev.filter((e) => now - e.timestamp < 500);
      return filtered.length !== prev.length ? filtered : prev;
    });

    animRef.current = requestAnimationFrame(gameLoop);
  }, [chart, speedMultiplier, fallDurationMs, spawnTiles, round, audio, applyHealthChange]);

  useEffect(() => {
    if (gamePhase === "playing") {
      animRef.current = requestAnimationFrame(gameLoop);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [gamePhase, gameLoop]);

  // ─── HIT DETECTION — immediate ref-based, NO wrong-lane fail ───
  const handleLaneTap = useCallback((lane: number) => {
    if (gamePhaseRef.current !== "playing") return;
    const songTimeMs = audio.getSongTimeMs();

    holdingLanesRef.current.add(lane);

    const tiles = tilesRef.current;
    const HIT_WINDOW_MS = 400;
    let bestTile: GameTile | null = null;
    let bestDist = Infinity;

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (t.hit || t.holding) continue;
      const inLane = t.lane === lane || (t.type === "double" && t.lane2 === lane);
      if (!inLane) continue;

      const timeDelta = Math.abs(t.chartTime - songTimeMs);
      const visuallyNear = t.y >= 40 && t.y <= 105;

      if (timeDelta <= HIT_WINDOW_MS || visuallyNear) {
        if (timeDelta < bestDist) {
          bestDist = timeDelta;
          bestTile = t;
        }
      }
    }

    // No matching tile? Just ignore — NO fail, NO penalty (AutoRhythm style)
    if (!bestTile) return;

    const target = bestTile;
    const deltaMs = target.chartTime - songTimeMs;
    const label = getHitLabel(deltaMs);
    const currentCombo = comboRef.current + 1;
    const scoreGain = getScoreForHit(label, comboRef.current);

    scoreRef.current += scoreGain;
    comboRef.current = currentCombo;
    if (currentCombo > maxComboRef.current) maxComboRef.current = currentCombo;
    totalHitsRef.current++;

    // Apply health gain
    applyHealthChange(label);

    playTapSound(lane);
    triggerVibration();

    // Mutate ref directly for instant resolution
    for (let i = 0; i < tilesRef.current.length; i++) {
      const t = tilesRef.current[i];
      if (t.id !== target.id) continue;

      if (t.type === "hold") {
        tilesRef.current[i] = { ...t, holding: true };
      } else if (t.type === "double") {
        const hitPrimary = t.lane === lane ? true : t.hit;
        const hitSecond = t.lane2 === lane ? true : t.hit2;
        if (hitPrimary && hitSecond) {
          tilesRef.current[i] = { ...t, hit: true, hit2: true };
        } else {
          tilesRef.current[i] = { ...t, hit: hitPrimary, hit2: hitSecond };
        }
      } else {
        tilesRef.current[i] = { ...t, hit: true };
      }
      break;
    }

    setScore(scoreRef.current);
    setCombo(currentCombo);
    setMaxCombo(maxComboRef.current);
    setTotalHits(totalHitsRef.current);
    setHitEffects((prev) => [...prev, {
      id: target.id, lane, y: target.y, label, timestamp: Date.now(),
    }]);
    setRenderTiles([...tilesRef.current]);
  }, [audio, applyHealthChange]);

  const handleLaneRelease = useCallback((lane: number) => {
    holdingLanesRef.current.delete(lane);
    let updated = false;
    for (let i = 0; i < tilesRef.current.length; i++) {
      const t = tilesRef.current[i];
      if (t.type === "hold" && t.holding && t.lane === lane) {
        const scoreGain = getScoreForHit("GREAT", comboRef.current);
        scoreRef.current += scoreGain;
        setScore(scoreRef.current);
        tilesRef.current[i] = { ...t, holding: false, holdComplete: true, hit: true };
        updated = true;
      }
    }
    if (updated) setRenderTiles([...tilesRef.current]);
  }, []);

  // ─── KEYBOARD CONTROLS (from AutoRhythm: Z, X, ,, . for 4 lanes) ───
  useEffect(() => {
    if (gamePhase !== "playing") return;

    const pressedKeys = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (pressedKeys.has(e.key)) return; // Prevent key repeat
      pressedKeys.add(e.key);
      const lane = KEYBOARD_LANE_MAP[e.key];
      if (lane !== undefined) {
        e.preventDefault();
        handleLaneTap(lane);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.key);
      const lane = KEYBOARD_LANE_MAP[e.key];
      if (lane !== undefined) {
        e.preventDefault();
        handleLaneRelease(lane);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gamePhase, handleLaneTap, handleLaneRelease]);

  const resetGame = useCallback(() => {
    tilesRef.current = [];
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    totalHitsRef.current = 0;
    healthRef.current = HEALTH.INITIAL;
    tileIdRef.current = 0;
    chartIndexRef.current = 0;
    beatCountRef.current = 0;
    holdingLanesRef.current.clear();
    setRenderTiles([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTotalHits(0);
    setHealth(HEALTH.INITIAL);
    setHitEffects([]);
    audio.stopPlayback();
  }, [audio]);

  const startGame = useCallback(() => {
    resetGame();
    setRound(0);
    setStageIndex(0);
    setBeatFlash(false);
    audio.startPlayback(LEAD_IN_MS, ROUND_SPEEDS[0]);
    setGamePhase("playing");
  }, [resetGame, audio]);

  const startNextRound = useCallback(() => {
    const nextRound = round + 1;
    const nextSpeed = ROUND_SPEEDS[Math.min(nextRound, ROUND_SPEEDS.length - 1)];
    resetGame();
    setRound(nextRound);
    audio.startPlayback(LEAD_IN_MS, nextSpeed);
    setGamePhase("playing");
  }, [resetGame, round, audio]);

  if (!song || !chart) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: STAGE_THEMES[0].bg }}>
        <p className="text-white/80 text-lg">Song not found.</p>
      </div>
    );
  }

  const stage = STAGE_THEMES[stageIndex % STAGE_THEMES.length];

  return (
    <div
      className="flex min-h-[100dvh] flex-col relative overflow-hidden select-none touch-none"
      style={{
        background: stage.bg,
        transition: "background 2s ease",
        filter: beatFlash ? "brightness(1.3)" : "brightness(1)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none tibeb-pattern opacity-30" />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-[200%] h-[30%] top-[10%] left-[-50%] rotate-[-12deg] blur-[60px]"
          style={{ background: stage.accent }}
        />
        <div
          className="absolute w-[200%] h-[15%] top-[55%] left-[-50%] rotate-[8deg] blur-[40px]"
          style={{ background: stage.accent }}
        />
      </div>

      {beatFlash && (
        <div className="absolute inset-0 pointer-events-none z-[2] animate-beat-flash"
          style={{ background: "radial-gradient(ellipse at center, rgba(234,179,8,0.15), transparent 70%)" }}
        />
      )}

      {gamePhase === "playing" && (
        <GameHUD
          score={score}
          combo={combo}
          round={round}
          totalNotes={chart.notes.length}
          currentHits={totalHits}
          health={health}
          onBack={() => navigate(-1)}
          onPause={() => {
            setGamePhase("paused");
            audio.pausePlayback();
          }}
        />
      )}

      <div className="relative flex-1 mx-auto w-full max-w-md overflow-hidden">
        <GameLanes tiles={renderTiles} onLaneTap={handleLaneTap} onLaneRelease={handleLaneRelease} bpm={chart.bpm} fallDurationMs={fallDurationMs} />
        <HitEffects effects={hitEffects} combo={combo} />

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
