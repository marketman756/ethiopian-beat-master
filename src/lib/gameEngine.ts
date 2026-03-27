/**
 * Game Engine — core types, constants, and audio for the rhythm game.
 * Patterns ported from AutoRhythm (health system, combo multiplier, judgment tiers)
 * and Piano Tiles Flutter (sequential validation, per-lane audio).
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

// ─── HEALTH SYSTEM (from AutoRhythm) ───
export const HEALTH = {
  MAX: 100,
  INITIAL: 100,
  GAIN_PERFECT: 3,
  GAIN_GREAT: 2,
  GAIN_GOOD: 1,
  GAIN_BAD: 0,
  REDUCE_MISS: 15,
  FAIL_THRESHOLD: 0,
};

// ─── HIT WINDOWS (inspired by AutoRhythm's tiered judgment) ───
export const HIT_WINDOWS = {
  FLAWLESS: 40,   // ±40ms — pixel perfect
  PERFECT: 80,    // ±80ms — very tight
  GREAT: 130,     // ±130ms — good
  GOOD: 200,      // ±200ms — acceptable
  BAD: 300,       // ±300ms — late but counted
} as const;

export function getHitLabel(deltaMs: number): string {
  const abs = Math.abs(deltaMs);
  if (abs <= HIT_WINDOWS.FLAWLESS) return "FLAWLESS";
  if (abs <= HIT_WINDOWS.PERFECT) return "PERFECT";
  if (abs <= HIT_WINDOWS.GREAT) return "GREAT";
  if (abs <= HIT_WINDOWS.GOOD) return "GOOD";
  return "BAD";
}

// ─── SCORING (from AutoRhythm: score = base * combo multiplier) ───
export function getScoreForHit(label: string, combo: number): number {
  const base =
    label === "FLAWLESS" ? 300 :
    label === "PERFECT" ? 200 :
    label === "GREAT" ? 100 :
    label === "GOOD" ? 50 : 25;
  // Combo multiplier: 1x at combo 0, up to 4x at combo 100+
  const multiplier = 1 + Math.min(combo, 100) * 0.03;
  return Math.round(base * multiplier);
}

export function getHealthChange(label: string): number {
  switch (label) {
    case "FLAWLESS": return HEALTH.GAIN_PERFECT;
    case "PERFECT": return HEALTH.GAIN_PERFECT;
    case "GREAT": return HEALTH.GAIN_GREAT;
    case "GOOD": return HEALTH.GAIN_GOOD;
    case "BAD": return HEALTH.GAIN_BAD;
    default: return -HEALTH.REDUCE_MISS;
  }
}

/**
 * Web Audio API sound engine — generates piano-like tap sounds with zero latency.
 * Per-lane note frequencies inspired by Piano Tiles Flutter (different note per lane).
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

// Piano note frequencies for each lane (C4, E4, G4, C5) — matches Flutter repo
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

// ─── KEYBOARD MAPPING (from AutoRhythm: Z, X, ,, . for 4 lanes) ───
export const KEYBOARD_LANE_MAP: Record<string, number> = {
  'z': 0, 'Z': 0,
  'x': 1, 'X': 1,
  ',': 2,
  '.': 3,
  // Alternative WASD-style for accessibility
  'd': 0, 'D': 0,
  'f': 1, 'F': 1,
  'j': 2, 'J': 2,
  'k': 3, 'K': 3,
};
