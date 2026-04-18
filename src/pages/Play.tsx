import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { songs } from "@/lib/songs";
import { getChartForSong, ChartNote } from "@/lib/tileCharts";
import {
  LANES, ROUND_SPEEDS, GamePhase, GameTile, HitEffect, HEALTH, HIT_WINDOWS,
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

// MT3: vibrant Blue → Green → Yellow cycling backgrounds
const STAGE_THEMES = [
  { bg: "linear-gradient(180deg, #1a237e 0%, #283593 30%, #3949ab 60%, #5c6bc0 100%)" },
  { bg: "linear-gradient(180deg, #1b5e20 0%, #2e7d32 30%, #43a047 60%, #66bb6a 100%)" },
  { bg: "linear-gradient(180deg, #f57f17 0%, #f9a825 30%, #fbc02d 60%, #fdd835 100%)" },
  { bg: "linear-gradient(180deg, #1a237e 0%, #283593 30%, #3949ab 60%, #5c6bc0 100%)" },
  { bg: "linear-gradient(180deg, #1b5e20 0%, #2e7d32 30%, #43a047 60%, #66bb6a 100%)" },
  { bg: "linear-gradient(180deg, #f57f17 0%, #f9a825 30%, #fbc02d 60%, #fdd835 100%)" },
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
  const [songProgress, setSongProgress] = useState(0);
  const [canRevive, setCanRevive] = useState(true); // MT3: one free revive per attempt

  const [renderTiles, setRenderTiles] = useState<GameTile[]>([]);
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([]);
  const [scorePopups, setScorePopups] = useState<{ id: number; lane: number; value: number; timestamp: number }[]>([]);

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
  const beatFlashRef = useRef(false);
  // Store fail state for revive
  const failStateRef = useRef<{ songTimeMs: number; chartIndex: number } | null>(null);

  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);

  const speedMultiplier = ROUND_SPEEDS[Math.min(round, ROUND_SPEEDS.length - 1)];
  const fallDurationMs = chart ? getFallDurationMs(chart.bpm) / speedMultiplier : 2000;

  // Compute total song duration from chart
  const totalSongDurationMs = chart ? Math.max(...chart.notes.map(n => n.time), 0) + 5000 : 1;

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

  // Health change
  const applyHealthChange = useCallback((label: string) => {
    const delta = getHealthChange(label);
    healthRef.current = Math.max(0, Math.min(HEALTH.MAX, healthRef.current + delta));
    setHealth(healthRef.current);

    if (healthRef.current <= HEALTH.FAIL_THRESHOLD) {
      playMissSound();
      triggerVibration(100);
      // Save state for potential revive
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

  // Game loop
  const gameLoop = useCallback(() => {
    if (!chart || gamePhaseRef.current !== "playing") return;

    const songTimeMs = audio.getSongTimeMs();
    const beatMs = 60000 / chart.bpm;

    // MT3: time-based song progress
    setSongProgress(songTimeMs / totalSongDurationMs);

    // MT3: cycle background every 16 bars (64 beats)
    const currentBeat = Math.floor(songTimeMs / beatMs);
    if (currentBeat > 0 && currentBeat % 64 === 0 && currentBeat !== beatCountRef.current) {
      beatCountRef.current = currentBeat;
      setStageIndex((i) => i + 1);
    }

    // Beat-drop flash every 4 beats — derive directly from beat index, no setTimeout.
    const beatPhase = (songTimeMs / beatMs) % 4;
    const flashOn = beatPhase < 0.15 && beatPhase >= 0;
    if (flashOn !== beatFlashRef.current) {
      beatFlashRef.current = flashOn;
      setBeatFlash(flashOn);
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

    // Miss detection — drain health, don't instant fail
    const missedTiles = tiles.filter((t) => !t.hit && !t.holding && t.y > HIT_ZONE_Y + 20);
    if (missedTiles.length > 0) {
      for (const missed of missedTiles) {
        missed.hit = true;
        comboRef.current = 0;
        setCombo(0);
        const failed = applyHealthChange("MISS");
        if (failed) {
          tilesRef.current = tiles;
          setRenderTiles([...tiles]);
          return;
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

    // GC short-lived FX — only re-render the lists when something actually expires.
    const now = performance.now();
    setHitEffects((prev) => {
      const filtered = prev.filter((e) => now - e.timestamp < 500);
      return filtered.length !== prev.length ? filtered : prev;
    });
    setScorePopups((prev) => {
      const filtered = prev.filter((p) => now - p.timestamp < 600);
      return filtered.length !== prev.length ? filtered : prev;
    });

    animRef.current = requestAnimationFrame(gameLoop);
  }, [chart, fallDurationMs, spawnTiles, round, audio, applyHealthChange, totalSongDurationMs]);

  useEffect(() => {
    if (gamePhase === "playing") {
      animRef.current = requestAnimationFrame(gameLoop);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [gamePhase, gameLoop]);

  // Hit detection — pure timing-based, lane-aware, NO wrong-lane penalty.
  const handleLaneTap = useCallback((lane: number) => {
    if (gamePhaseRef.current !== "playing") return;
    const songTimeMs = audio.getSongTimeMs();

    // Track lane-down for hold tiles (idempotent).
    holdingLanesRef.current.add(lane);

    const tiles = tilesRef.current;
    let bestTile: GameTile | null = null;
    let bestAbsDelta = Infinity;

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (t.hit && t.type !== "double") continue;
      if (t.type === "hold" && t.holding) continue;

      const inLane =
        t.lane === lane ||
        (t.type === "double" && t.lane2 === lane && !t.hit2);
      if (!inLane) continue;

      const absDelta = Math.abs(t.chartTime - songTimeMs);
      if (absDelta <= HIT_WINDOWS.MAX_REGISTRABLE && absDelta < bestAbsDelta) {
        bestAbsDelta = absDelta;
        bestTile = t;
      }
    }

    // No tile in window? Silently ignore. Free taps are forgiven.
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

    applyHealthChange(label);
    playTapSound(lane);
    triggerVibration();

    // Mutate ref directly for instant resolution.
    for (let i = 0; i < tilesRef.current.length; i++) {
      const t = tilesRef.current[i];
      if (t.id !== target.id) continue;

      if (t.type === "hold") {
        tilesRef.current[i] = { ...t, holding: true };
      } else if (t.type === "double") {
        const hitPrimary = t.lane === lane ? true : t.hit;
        const hitSecond = t.lane2 === lane ? true : t.hit2;
        tilesRef.current[i] = {
          ...t,
          hit: hitPrimary && hitSecond,
          hit2: hitSecond,
        };
        // Ensure single-lane tap on a double doesn't immediately disappear.
        if (!(hitPrimary && hitSecond)) {
          tilesRef.current[i] = { ...t, hit: false, hit2: hitSecond };
          if (hitPrimary) tilesRef.current[i] = { ...tilesRef.current[i], hit: true };
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
    const now = performance.now();
    setHitEffects((prev) => [...prev, {
      id: target.id, lane, y: target.y, label, timestamp: now,
    }]);
    setScorePopups((prev) => [...prev, { id: target.id, lane, value: scoreGain, timestamp: now }]);
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

  // Keyboard controls
  useEffect(() => {
    if (gamePhase !== "playing") return;

    const pressedKeys = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (pressedKeys.has(e.key)) return;
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
    failStateRef.current = null;
    setRenderTiles([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTotalHits(0);
    setHealth(HEALTH.INITIAL);
    setHitEffects([]);
    setScorePopups([]);
    setSongProgress(0);
    audio.stopPlayback();
  }, [audio]);

  const startGame = useCallback(() => {
    resetGame();
    setRound(0);
    setStageIndex(0);
    setBeatFlash(false);
    setCanRevive(true);
    audio.startPlayback(LEAD_IN_MS, ROUND_SPEEDS[0]);
    setGamePhase("playing");
  }, [resetGame, audio]);

  // MT3: Revive — restore health and continue from where player failed
  const handleRevive = useCallback(() => {
    if (!failStateRef.current) return;
    healthRef.current = HEALTH.MAX;
    setHealth(HEALTH.MAX);
    comboRef.current = 0;
    setCombo(0);
    setCanRevive(false); // Only one revive per attempt
    
    // Clear missed tiles and resume
    tilesRef.current = tilesRef.current.filter(t => !t.hit || t.type === "hold");
    setRenderTiles([...tilesRef.current]);
    
    // Resume audio from fail point
    audio.startPlayback(0, speedMultiplier);
    setGamePhase("playing");
  }, [audio, speedMultiplier]);

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
      }}
    >
      {/* MT3: soft circular bokeh light effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[300px] h-[300px] rounded-full blur-[100px] top-[5%] left-[10%] opacity-20" style={{ background: "rgba(255,255,255,0.3)" }} />
        <div className="absolute w-[200px] h-[200px] rounded-full blur-[80px] top-[40%] right-[5%] opacity-15" style={{ background: "rgba(255,255,255,0.2)" }} />
        <div className="absolute w-[250px] h-[250px] rounded-full blur-[90px] bottom-[10%] left-[20%] opacity-10" style={{ background: "rgba(255,255,255,0.25)" }} />
      </div>

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

      <div className="relative flex-1 mx-auto w-full max-w-md overflow-hidden">
        <GameLanes tiles={renderTiles} onLaneTap={handleLaneTap} onLaneRelease={handleLaneRelease} bpm={chart.bpm} fallDurationMs={fallDurationMs} />
        <HitEffects effects={hitEffects} combo={combo} />

        {/* MT3: Score increment popups (+2, +3, +4) near hit zone */}
        {scorePopups.map((popup) => {
          const age = performance.now() - popup.timestamp;
          if (age > 600) return null;
          const laneWidth = 100 / LANES;
          return (
            <div
              key={`sp-${popup.id}-${popup.timestamp}`}
              className="absolute pointer-events-none z-20 flex items-center justify-center"
              style={{
                left: `${popup.lane * laneWidth}%`,
                width: `${laneWidth}%`,
                top: "75%",
                animation: "score-pop 0.6s ease-out forwards",
              }}
            >
              <span
                className="text-sm font-black font-display tabular-nums"
                style={{
                  color: "#fbc02d",
                  textShadow: "0 0 8px rgba(251,192,45,0.6), 0 2px 4px rgba(0,0,0,0.5)",
                }}
              >
                +{popup.value}
              </span>
            </div>
          );
        })}

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
          <SongCompleteOverlay song={song} score={score} maxCombo={maxCombo} totalHits={totalHits} totalNotes={chart.notes.length} onRetry={startGame} onQuit={() => navigate("/library")} />
        )}
      </div>
    </div>
  );
};

export default Play;
