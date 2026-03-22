import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
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

const BASE_FALL_SPEED = 3.5; // % per frame at 60fps
const HIT_ZONE_TOP = 70;
const HIT_ZONE_BOTTOM = 95;
const HOLD_HEIGHT_BASE = 18; // % of game area

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

  const tileIdRef = useRef(0);
  const animRef = useRef<number>();
  const lastTimeRef = useRef(0);
  const gameTimeRef = useRef(0); // elapsed game time in ms
  const chartIndexRef = useRef(0);
  const holdingLanesRef = useRef<Set<number>>(new Set());
  const tilesRef = useRef<GameTile[]>([]);

  // Keep ref in sync
  useEffect(() => { tilesRef.current = tiles; }, [tiles]);

  const speedMultiplier = ROUND_SPEEDS[Math.min(round, ROUND_SPEEDS.length - 1)];
  const currentSpeed = BASE_FALL_SPEED * speedMultiplier;

  // Loading animation
  useEffect(() => {
    if (gamePhase !== "loading") return;
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
  }, [gamePhase]);

  useEffect(() => {
    if (loadingProgress >= 100 && gamePhase === "loading") {
      setGamePhase("ready");
    }
  }, [loadingProgress, gamePhase]);

  // Convert chart time to y position
  // A note should reach the hit zone (HIT_ZONE_TOP) at its chart time
  const chartTimeToY = useCallback((noteTime: number, currentGameTime: number) => {
    const timeDiff = noteTime - currentGameTime; // ms until note should be hit
    // At currentSpeed %/frame and 60fps, speed in %/ms = currentSpeed * 60 / 1000
    const speedPerMs = (currentSpeed * 60) / 1000;
    return HIT_ZONE_TOP - timeDiff * speedPerMs;
  }, [currentSpeed]);

  const spawnUpcomingTiles = useCallback((gameTime: number, notes: ChartNote[]) => {
    const speedPerMs = (currentSpeed * 60) / 1000;
    const lookAheadMs = (120 / speedPerMs); // how far ahead to spawn (in ms) so tiles start from top

    const newTiles: GameTile[] = [];
    while (chartIndexRef.current < notes.length) {
      const note = notes[chartIndexRef.current];
      const y = chartTimeToY(note.time, gameTime);

      if (y > -20) {
        // Time to spawn
        tileIdRef.current++;
        const holdHeight = note.type === "hold" && note.holdDuration
          ? (note.holdDuration * speedPerMs) + HOLD_HEIGHT_BASE
          : 0;

        newTiles.push({
          id: tileIdRef.current,
          lane: note.lane,
          type: note.type,
          lane2: note.lane2,
          y,
          holdHeight,
          hit: false,
          holding: false,
          holdComplete: false,
          hit2: false,
          chartTime: note.time,
        });

        chartIndexRef.current++;
      } else {
        break; // future notes not yet visible
      }
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

    setTiles((prev) => {
      let updated = prev.map((t) => {
        if (t.hit && t.type !== "hold") return t;
        const newY = chartTimeToY(t.chartTime, gameTime);

        // Hold tile logic
        if (t.type === "hold" && t.holding) {
          // Check if player is still holding
          if (!holdingLanesRef.current.has(t.lane)) {
            return { ...t, y: newY, holding: false, holdComplete: true, hit: true };
          }
        }

        return { ...t, y: newY };
      });

      // Check for missed tiles (passed the hit zone without being tapped)
      const missed = updated.find(
        (t) => !t.hit && !t.holding && t.y > HIT_ZONE_BOTTOM + 5
      );

      if (missed) {
        // INSTANT FAIL
        setGamePhase("failed");
        return updated;
      }

      // Spawn upcoming tiles
      const spawned = spawnUpcomingTiles(gameTime, chart.notes);
      if (spawned.length > 0) {
        updated = [...updated, ...spawned];
      }

      // Remove tiles that are way off screen
      updated = updated.filter((t) => t.y < 130 && t.y > -30);

      // Check if all notes have been played
      if (
        chartIndexRef.current >= chart.notes.length &&
        updated.filter((t) => !t.hit && t.type !== "hold").length === 0 &&
        updated.filter((t) => t.type === "hold" && !t.holdComplete && !t.hit).length === 0
      ) {
        // Round complete
        if (round < ROUND_SPEEDS.length - 1) {
          setGamePhase("round-complete");
        } else {
          setGamePhase("song-complete");
        }
        return updated;
      }

      return updated;
    });

    // Clean old hit effects
    setHitEffects((prev) => prev.filter((e) => Date.now() - e.timestamp < 500));

    animRef.current = requestAnimationFrame(gameLoop);
  }, [chart, speedMultiplier, chartTimeToY, spawnUpcomingTiles, round]);

  // Start/stop game loop
  useEffect(() => {
    if (gamePhase === "playing") {
      lastTimeRef.current = 0;
      animRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [gamePhase, gameLoop]);

  const handleLaneTap = useCallback((lane: number) => {
    if (gamePhase !== "playing") return;
    // Grace period: don't process taps during the pre-start delay
    if (gameTimeRef.current < 200) return;
    holdingLanesRef.current.add(lane);

    setTiles((prev) => {
      // Find the lowest (closest to hit zone) unhit tile in this lane
      const hittable = prev
        .filter((t) => {
          if (t.hit || t.holding) return false;
          // Check primary lane
          const inLane = t.lane === lane || (t.type === "double" && t.lane2 === lane);
          if (!inLane) return false;
          // Must be in or near hit zone
          return t.y >= HIT_ZONE_TOP - 15 && t.y <= HIT_ZONE_BOTTOM;
        })
        .sort((a, b) => b.y - a.y); // closest to bottom first

      if (hittable.length === 0) {
        // Tapped wrong area — INSTANT FAIL
        // Only fail if tiles are actually in/near the hit zone (not just anywhere on screen)
        const tilesNearHitZone = prev.filter(
          (t) => !t.hit && t.y > HIT_ZONE_TOP - 30 && t.y < HIT_ZONE_BOTTOM + 10
        );
        if (tilesNearHitZone.length > 0) {
          setGamePhase("failed");
        }
        return prev;
      }

      const target = hittable[0];
      const accuracy = Math.abs(target.y - 82);
      const label = getHitLabel(accuracy);
      const scoreGain = getScoreForHit(label, combo);

      setScore((s) => s + scoreGain);
      setTotalHits((h) => h + 1);
      setCombo((c) => {
        const next = c + 1;
        setMaxCombo((m) => Math.max(m, next));
        return next;
      });

      setHitEffects((prev) => [
        ...prev,
        { id: target.id, lane, y: target.y, label, timestamp: Date.now() },
      ]);

      return prev.map((t) => {
        if (t.id !== target.id) return t;

        if (t.type === "hold") {
          return { ...t, holding: true };
        }

        if (t.type === "double") {
          const hitPrimary = t.lane === lane ? true : t.hit;
          const hitSecond = t.lane2 === lane ? true : t.hit2;
          if (hitPrimary && hitSecond) {
            return { ...t, hit: true, hit2: true };
          }
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
    setTiles([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTotalHits(0);
    setHitEffects([]);
    setRound(0);
    tileIdRef.current = 0;
    chartIndexRef.current = 0;
    gameTimeRef.current = -800; // pre-start delay
    holdingLanesRef.current.clear();
    setGamePhase("playing");
  }, []);

  const startNextRound = useCallback(() => {
    setTiles([]);
    setHitEffects([]);
    setRound((r) => r + 1);
    tileIdRef.current = 0;
    chartIndexRef.current = 0;
    gameTimeRef.current = -800;
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
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-br from-sky-300 via-blue-400 to-purple-500 relative overflow-hidden select-none touch-none">
      {/* Diamond pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.3) 40px, rgba(255,255,255,0.3) 42px),
            repeating-linear-gradient(-45deg, transparent, transparent 40px, rgba(255,255,255,0.3) 40px, rgba(255,255,255,0.3) 42px)`,
        }}
      />

      {/* HUD */}
      {gamePhase === "playing" && (
        <GameHUD
          score={score}
          combo={combo}
          round={round}
          onBack={() => navigate(-1)}
          onPause={() => setGamePhase("paused")}
        />
      )}

      {/* Game area */}
      <div className="relative flex-1 mx-auto w-full max-w-md overflow-hidden">
        {/* Bottom glow */}
        <div className="absolute bottom-0 left-0 right-0 h-[18%] bg-gradient-to-t from-purple-600/40 to-transparent pointer-events-none z-[1]" />

        <GameLanes
          tiles={tiles}
          onLaneTap={handleLaneTap}
          onLaneRelease={handleLaneRelease}
        />
        <HitEffects effects={hitEffects} />

        {/* Overlays */}
        {(gamePhase === "loading" || gamePhase === "ready") && (
          <ReadyOverlay song={song} loadingProgress={loadingProgress} onStart={startGame} />
        )}
        {gamePhase === "paused" && (
          <PauseOverlay onResume={() => setGamePhase("playing")} onQuit={() => navigate("/library")} />
        )}
        {gamePhase === "failed" && (
          <FailOverlay
            song={song}
            score={score}
            maxCombo={maxCombo}
            round={round}
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
      </div>
    </div>
  );
};

export default Play;
