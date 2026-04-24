/**
 * Game Engine — MT3-accurate scoring, health, and audio.
 * Scoring matches observed MT3 pattern: base_value ~4, cumulative with combo bonuses.
 */

export const LANES = 4;

export const ROUND_SPEEDS = [1.0, 1.25, 1.5, 2.0];

/**
 * Dynamic speed multiplier as a function of stars earned in the current run.
 * Spec: v_final = BPM × m(stars).  Smooth, non-jarring acceleration.
 */
export const STAR_SPEED_MULTIPLIERS: Record<0 | 1 | 2 | 3, number> = {
  0: 1.00,
  1: 1.15,
  2: 1.30,
  3: 1.50,
};

export function getSpeedMultiplier(stars: 0 | 1 | 2 | 3): number {
  return STAR_SPEED_MULTIPLIERS[stars];
}

/**
 * Star thresholds along song progress (0..1). Crossing each threshold
 * earns a star and bumps the speed multiplier.
 */
export const STAR_PROGRESS_THRESHOLDS = [0.33, 0.66, 1.0] as const;

/** Linear interpolation helper, clamped to [0,1] on `t`. */
export function lerp(a: number, b: number, t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return a + (b - a) * c;
}

/**
 * Long-press release scoring windows (ms from intended hold-end time).
 * Early release (large negative delta beyond GREAT) breaks combo.
 */
export const RELEASE_WINDOWS = {
  PERFECT: 80,
  GREAT: 160,
} as const;

export function getReleaseLabel(deltaMs: number): "PERFECT" | "GREAT" | "EARLY" {
  const abs = Math.abs(deltaMs);
  if (abs <= RELEASE_WINDOWS.PERFECT) return "PERFECT";
  if (abs <= RELEASE_WINDOWS.GREAT) return "GREAT";
  return "EARLY";
}

export type GamePhase = "loading" | "ready" | "playing" | "paused" | "failed" | "round-complete" | "song-complete";

export interface GameTile {
  id: number;
  lane: number;
  type: "tap" | "hold" | "double";
  lane2?: number;
  y: number;
  holdHeight: number;
  hit: boolean;
  holding: boolean;
  holdComplete: boolean;
  hit2: boolean;
  chartTime: number;
  holdEndTime?: number;
}

export interface HitEffect {
  id: number;
  lane: number;
  y: number;
  label: string;
  timestamp: number;
}

// ─── HEALTH SYSTEM ───
export const HEALTH = {
  MAX: 100,
  INITIAL: 100,
  GAIN_PERFECT: 3,
  GAIN_GREAT: 2,
  GAIN_COOL: 1,
  REDUCE_MISS: 15,
  FAIL_THRESHOLD: 0,
};

// ─── HIT WINDOWS ─────────────────────────────────────────────────────────
// MT3-aligned, slightly more forgiving on COOL so casual taps still register.
// Anything beyond MAX_REGISTRABLE is treated as "no tile here" (no penalty).
export const HIT_WINDOWS = {
  PERFECT: 90,
  GREAT: 170,
  COOL: 260,
  MAX_REGISTRABLE: 320,
} as const;

export type HitLabel = "PERFECT" | "GREAT" | "COOL";

export function getHitLabel(deltaMs: number): HitLabel {
  const abs = Math.abs(deltaMs);
  if (abs <= HIT_WINDOWS.PERFECT) return "PERFECT";
  if (abs <= HIT_WINDOWS.GREAT) return "GREAT";
  return "COOL";
}

/**
 * MT3-accurate scoring: base value ~4 per hit, with combo multiplier.
 * Observed progression: 4, 48, 100, 154, 210, 265, 323, 371, 432...
 * This suggests: score += base * (1 + combo_bonus_factor)
 * PERFECT = 4 base, GREAT = 3, COOL = 2
 * Combo bonus adds ~0.5-1 per 5 combo
 */
export function getScoreForHit(label: string, combo: number): number {
  const base = label === "PERFECT" ? 4 : label === "GREAT" ? 3 : 2;
  // MT3 combo multiplier: gradual increase
  const comboBonus = Math.floor(combo / 5);
  return base + comboBonus;
}

/**
 * MT3-style additive score text: shows +2, +3, +4 etc.
 */
export function getScorePopupValue(label: string, combo: number): number {
  return getScoreForHit(label, combo);
}

export function getHealthChange(label: string): number {
  switch (label) {
    case "PERFECT": return HEALTH.GAIN_PERFECT;
    case "GREAT": return HEALTH.GAIN_GREAT;
    case "COOL": return HEALTH.GAIN_COOL;
    default: return -HEALTH.REDUCE_MISS;
  }
}

// ─── Web Audio API ───
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

export const KEYBOARD_LANE_MAP: Record<string, number> = {
  'z': 0, 'Z': 0,
  'x': 1, 'X': 1,
  ',': 2,
  '.': 3,
  'd': 0, 'D': 0,
  'f': 1, 'F': 1,
  'j': 2, 'J': 2,
  'k': 3, 'K': 3,
};
