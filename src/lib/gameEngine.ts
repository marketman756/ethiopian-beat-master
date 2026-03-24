/**
 * Game Engine — core types, constants, and audio for the rhythm game.
 * Timing is ms-based for accurate hit detection matching Magic Tiles 3.
 */

export const LANES = 4;

// Speed multipliers per round
export const ROUND_SPEEDS = [1.0, 1.25, 1.5, 2.0];

export type GamePhase = "loading" | "ready" | "playing" | "paused" | "failed" | "round-complete" | "song-complete";

export interface GameTile {
  id: number;
  lane: number;
  type: "tap" | "hold" | "double";
  lane2?: number;
  /** Position as percentage from top (0 = top, 100 = bottom) */
  y: number;
  /** For hold tiles — height percentage */
  holdHeight: number;
  hit: boolean;
  holding: boolean;
  holdComplete: boolean;
  hit2: boolean;
  /** Chart time in ms — the CANONICAL timing reference */
  chartTime: number;
  /** Hold end time in ms */
  holdEndTime?: number;
}

export interface HitEffect {
  id: number;
  lane: number;
  y: number;
  label: string;
  timestamp: number;
}

// Hit windows in milliseconds — matching Magic Tiles 3 feel
export const HIT_WINDOWS = {
  PERFECT: 50,
  GREAT: 100,
  COOL: 150,
  NICE: 200,
} as const;

export function getHitLabel(deltaMs: number): string {
  const abs = Math.abs(deltaMs);
  if (abs <= HIT_WINDOWS.PERFECT) return "PERFECT";
  if (abs <= HIT_WINDOWS.GREAT) return "GREAT";
  if (abs <= HIT_WINDOWS.COOL) return "COOL";
  return "NICE";
}

export function getScoreForHit(label: string, combo: number): number {
  const base = label === "PERFECT" ? 15 : label === "GREAT" ? 12 : label === "COOL" ? 8 : 5;
  return base + Math.floor(combo * 1.5);
}

/**
 * Web Audio API sound engine — generates piano-like tap sounds with zero latency.
 */
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// Piano note frequencies for each lane (C4, E4, G4, C5)
const LANE_NOTES = [261.63, 329.63, 392.00, 523.25];

export function playTapSound(lane: number) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(LANE_NOTES[lane % 4], ctx.currentTime);
    
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio not available
  }
}

export function playMissSound() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // Audio not available
  }
}

export function triggerVibration(ms: number = 30) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    // Not supported
  }
}
