/**
 * CanvasGame — canvas-based MT3 playfield.
 *
 * Owns the <canvas>, its renderer, the RAF loop, and pointer/keyboard input.
 * State (tiles/effects/popups) lives in refs; React only re-renders when
 * meta state (combo/lane-flash decay) needs to bubble up via props callbacks.
 */

import { memo, useCallback, useEffect, useRef } from "react";
import { CanvasRenderer, HIT_ZONE_RATIO } from "@/lib/CanvasRenderer";
import { GameTile, HitEffect, LANES, KEYBOARD_LANE_MAP } from "@/lib/gameEngine";

export interface CanvasGameHandle {
  setRenderState: (state: {
    tiles: GameTile[];
    hitEffects: HitEffect[];
    scorePopups: { id: number; lane: number; value: number; timestamp: number }[];
    combo: number;
    beatPhase: number;
    tileHeightFrac: number;
    starsEarned: 0 | 1 | 2 | 3;
  }) => void;
  flashLane: (lane: number) => void;
}

interface CanvasGameProps {
  onLaneTap: (lane: number) => void;
  onLaneRelease: (lane: number) => void;
  active: boolean;
  registerHandle: (handle: CanvasGameHandle) => void;
}

const CanvasGame = memo(({ onLaneTap, onLaneRelease, active, registerHandle }: CanvasGameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const stateRef = useRef({
    tiles: [] as GameTile[],
    hitEffects: [] as HitEffect[],
    scorePopups: [] as { id: number; lane: number; value: number; timestamp: number }[],
    combo: 0,
    beatPhase: 0,
    tileHeightFrac: 0.05,
    starsEarned: 0 as 0 | 1 | 2 | 3,
  });
  const laneFlashRef = useRef<number[]>([0, 0, 0, 0]);
  const rafRef = useRef<number>();
  const activeRef = useRef(active);

  useEffect(() => { activeRef.current = active; }, [active]);

  // ── Mount renderer ──
  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new CanvasRenderer(canvasRef.current);
    rendererRef.current = renderer;

    const loop = () => {
      // Decay lane flashes regardless of active — keeps them from getting stuck
      for (let i = 0; i < LANES; i++) {
        laneFlashRef.current[i] = Math.max(0, laneFlashRef.current[i] - 0.06);
      }
      renderer.render({ ...stateRef.current, laneFlash: laneFlashRef.current });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // ── Expose imperative handle to parent ──
  useEffect(() => {
    registerHandle({
      setRenderState: (s) => { stateRef.current = s; },
      flashLane: (lane) => {
        if (lane >= 0 && lane < LANES) laneFlashRef.current[lane] = 1;
      },
    });
  }, [registerHandle]);

  // ── Pointer input — instant, lane-mapped from x position ──
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeRef.current || !rendererRef.current) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const lane = Math.max(0, Math.min(LANES - 1, Math.floor((x / rect.width) * LANES)));
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
    // tag this pointer's lane so release goes to the same one
    laneByPointer.current.set(e.pointerId, lane);
    onLaneTap(lane);
  }, [onLaneTap]);

  const laneByPointer = useRef<Map<number, number>>(new Map());

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeRef.current) return;
    const lane = laneByPointer.current.get(e.pointerId);
    laneByPointer.current.delete(e.pointerId);
    if (lane !== undefined) onLaneRelease(lane);
  }, [onLaneRelease]);

  // ── Keyboard ──
  useEffect(() => {
    if (!active) return;
    const pressed = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      if (pressed.has(e.key)) return;
      pressed.add(e.key);
      const lane = KEYBOARD_LANE_MAP[e.key];
      if (lane !== undefined) {
        e.preventDefault();
        onLaneTap(lane);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      pressed.delete(e.key);
      const lane = KEYBOARD_LANE_MAP[e.key];
      if (lane !== undefined) onLaneRelease(lane);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [active, onLaneTap, onLaneRelease]);

  return (
    <div className="absolute inset-0 select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
        style={{ imageRendering: "auto" }}
      />
      {/* Single transparent input layer — lane mapped by x-coord. Fast & no per-lane DOM. */}
      <div
        className="absolute inset-0 touch-none"
        style={{ zIndex: 5 }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      {/* Hit-line glow strip is rendered by the canvas; HIT_ZONE_RATIO exposed for test parity. */}
      <div data-hit-zone-ratio={HIT_ZONE_RATIO} className="hidden" />
    </div>
  );
});

CanvasGame.displayName = "CanvasGame";

export default CanvasGame;