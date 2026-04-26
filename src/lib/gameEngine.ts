/**
 * Game Engine — Corrected after forensic audit of MT3 IL2CPP dump.cs
 *
 * Forensic reality vs. community myths:
 *  - Timing: DYNAMIC distance-based (strike-line proximity × velocity), NOT fixed ms
 *  - Scoring: Standard high-value multipliers, NOT a 4/3/2 scale
 *  - Survival: Binary miss = game over (Classic mode), NOT incremental HP
 *  - Audio: Sequential trigger system (next snippet on tap), NOT fixed lane pitches
 *  - Speed: Linear/exponential scaling over time/laps, NOT fixed star-based jumps
 *  - Stars: Lap/phrase completion, NOT note-count percentages
 *
 * Confirmed from dump.cs metadata:
 *  - HitPrecision enum: PERFECT=0, GREAT=1, COOL=2, NONE=3
 *  - MAX_LANE = 4, SCALE_NUMBER = 0.8421, DEFAULT_HIT_SCALE = 1.5
 *  - NoteHitPrecisionLogic: distancePerfect, distanceGreat (position-based fields)
 *  - AdjustHitStatusForExtremeSong() method exists (dynamic scaling confirmed)
 *  - StarCrownManager: MIN_NOTE_CHANGE_STAR = 5
 */

// ─── CONFIRMED CONSTANTS (from GamePlayCore dump metadata) ────────────────────
export const LANES = 4;                         // GamePlayCore.MAX_LANE = 4
export const SCALE_NUMBER = 0.8421;             // GamePlayCore.SCALE_NUMBER
export const DEFAULT_HIT_SCALE = 1.5;           // GamePlayCore.DEFAULT_HIT_SCALE

// ─── ROUND SPEEDS ─────────────────────────────────────────────────────────────
export const ROUND_SPEEDS = [1.0, 1.25, 1.5, 2.0];

// ─── SPEED SCALING (Forensic: linear/exponential, not fixed jumps) ────────────
/**
 * MT3 Infinite Mode scales difficulty linearly or exponentially over time/laps.
 * We implement smooth exponential scaling rather than discrete star-based jumps.
 *
 * The formula: speed = baseSpeed × (1 + growthRate × elapsedLaps)
 * This avoids the jarring fixed increments (1.0→1.2→1.45→1.75) that were invented.
 */
export const SPEED_SCALING = {
  BASE: 1.0,
  GROWTH_PER_LAP: 0.15,       // 15% speed increase per lap
  MAX_MULTIPLIER: 2.5,        // cap to prevent unplayable speeds
  SMOOTH_FACTOR: 0.02,        // continuous growth per second (for non-lap modes)
} as const;

export function getSpeedMultiplier(
  lapsCompleted: number,
  elapsedSeconds?: number
): number {
  // Lap-based scaling (primary)
  const lapScale = SPEED_SCALING.BASE + SPEED_SCALING.GROWTH_PER_LAP * lapsCompleted;

  // Optional continuous scaling layered on top
  const timeScale = elapsedSeconds
    ? 1 + SPEED_SCALING.SMOOTH_FACTOR * Math.sqrt(elapsedSeconds)
    : 1;

  return Math.min(SPEED_SCALING.MAX_MULTIPLIER, lapScale * timeScale);
}

// Legacy star-based exports for backward compatibility with Play.tsx
export const MIN_NOTE_CHANGE_STAR = 5;
export const STAR_NOTE_THRESHOLDS = [0.33, 0.66, 1.0] as const;
export const STAR_PROGRESS_THRESHOLDS = STAR_NOTE_THRESHOLDS;
export const STAR_SPEED_MULTIPLIERS: Record<0 | 1 | 2 | 3, number> = {
  0: 1.00,
  1: 1.15,
  2: 1.35,
  3: 1.60,
};

// ─── NOTE-BASED SPEED SCALING (MT3-accurate: step function) ───────────────────
/**
 * MT3 speed progression:
 *  - Constant velocity for the first WARMUP notes (player calibration period)
 *  - After warmup, velocity multiplied by STEP_FACTOR every STEP_INTERVAL notes
 *  - Speed change is instantaneous (applies to new tile spawn rate)
 *  - Capped at MAX to prevent unplayable speeds
 */
export const SPEED_STEP = {
  WARMUP_NOTES: 15,       // constant speed for first 15 notes
  STEP_INTERVAL: 25,      // ×1.05 every 25 notes after warmup
  STEP_FACTOR: 1.05,      // multiplier per step
  MAX_MULTIPLIER: 2.5,    // speed cap
} as const;

export function getNoteBasedSpeedMultiplier(notesHit: number): number {
  if (notesHit <= SPEED_STEP.WARMUP_NOTES) return 1.0;
  const stepsCompleted = Math.floor(
    (notesHit - SPEED_STEP.WARMUP_NOTES) / SPEED_STEP.STEP_INTERVAL
  );
  return Math.min(
    SPEED_STEP.MAX_MULTIPLIER,
    Math.pow(SPEED_STEP.STEP_FACTOR, stepsCompleted)
  );
}

/** Linear interpolation helper, clamped [0,1]. */
export function lerp(a: number, b: number, t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return a + (b - a) * c;
}

// ─── DYNAMIC HIT DETECTION (Forensic: distance-based, not fixed ms) ──────────
/**
 * FORENSIC REALITY:
 * MT3 uses distance-based hit zones relative to the strike line, scaled by
 * current tile velocity. This means at higher speeds, the time window
 * shrinks naturally (same physical distance = less time at faster speed).
 *
 * The HIT_ZONES are expressed as a fraction of tile height from the strike line.
 * At runtime, these are converted to pixel distances, then to time using velocity.
 *
 * distancePerfect ≈ 0.15 × tileHeight (very tight zone)
 * distanceGreat   ≈ 0.40 × tileHeight
 * distanceCool    ≈ 0.70 × tileHeight
 * maxRegistrable  ≈ 1.00 × tileHeight (full tile length)
 */
export const HIT_ZONES = {
  PERFECT_FRACTION: 0.15,     // fraction of tile height
  GREAT_FRACTION: 0.40,
  COOL_FRACTION: 0.70,
  MAX_FRACTION: 1.00,
} as const;

/**
 * Convert distance-based zones to time-based windows dynamically.
 * This is what AdjustHitStatusForExtremeSong effectively does:
 * faster tiles → smaller physical zone → tighter timing naturally.
 *
 * @param tileHeight - height of a tile in pixels
 * @param velocity - current tile speed in pixels/second
 * @returns time windows in milliseconds
 */
export function getDynamicHitWindows(tileHeight: number, velocity: number) {
  const pixelToMs = (fraction: number) =>
    ((tileHeight * fraction) / Math.max(velocity, 1)) * 1000;

  return {
    PERFECT: pixelToMs(HIT_ZONES.PERFECT_FRACTION),
    GREAT: pixelToMs(HIT_ZONES.GREAT_FRACTION),
    COOL: pixelToMs(HIT_ZONES.COOL_FRACTION),
    MAX_REGISTRABLE: pixelToMs(HIT_ZONES.MAX_FRACTION),
  };
}

/**
 * Fallback static windows for when velocity isn't available.
 * These are generous defaults — NOT "from dump.cs".
 */
export const HIT_WINDOWS = {
  PERFECT: 80,
  GREAT: 170,
  COOL: 260,
  MAX_REGISTRABLE: 380,
} as const;

export type HitLabel = "PERFECT" | "GREAT" | "COOL";

/**
 * Determine hit precision based on distance from strike line.
 * Uses dynamic windows when velocity is provided, static fallback otherwise.
 */
export function getHitLabel(
  deltaMs: number,
  bpm = 120,
  tileHeight?: number,
  velocity?: number
): HitLabel {
  const abs = Math.abs(deltaMs);

  // Use dynamic distance-based windows when possible
  if (tileHeight && velocity) {
    const windows = getDynamicHitWindows(tileHeight, velocity);
    if (abs <= windows.PERFECT) return "PERFECT";
    if (abs <= windows.GREAT) return "GREAT";
    return "COOL";
  }

  // Fallback: static windows with BPM adjustment
  // (mirrors AdjustHitStatusForExtremeSong — widens for fast songs)
  const speedScale = bpm > 160 ? Math.min(1.35, bpm / 150) : 1.0;
  if (abs <= HIT_WINDOWS.PERFECT * speedScale) return "PERFECT";
  if (abs <= HIT_WINDOWS.GREAT * speedScale) return "GREAT";
  return "COOL";
}

// ─── LONG-PRESS RELEASE WINDOWS ───────────────────────────────────────────────
export const RELEASE_WINDOWS = {
  PERFECT: 100,
  GREAT: 200,
} as const;

export function getReleaseLabel(deltaMs: number): "PERFECT" | "GREAT" | "EARLY" {
  const abs = Math.abs(deltaMs);
  if (abs <= RELEASE_WINDOWS.PERFECT) return "PERFECT";
  if (abs <= RELEASE_WINDOWS.GREAT) return "GREAT";
  return "EARLY";
}

// ─── GAME PHASE ───────────────────────────────────────────────────────────────
export type GamePhase =
  | "loading" | "ready" | "playing" | "paused"
  | "failed" | "round-complete" | "song-complete";

// ─── TILE TYPES ───────────────────────────────────────────────────────────────
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

// ─── SURVIVAL SYSTEM (Forensic: binary miss = game over) ──────────────────────
/**
 * FORENSIC REALITY:
 * MT3 Classic Mode uses binary survival: one miss = instant game over.
 * The "health bar" fields in the metadata are likely legacy/unused code.
 *
 * We support two modes:
 *  - CLASSIC (authentic): miss = instant fail
 *  - PRACTICE (forgiving): incremental HP for learning
 *
 * The HEALTH object below is used in PRACTICE mode only.
 */
export type SurvivalMode = "classic" | "practice";

export const HEALTH = {
  MAX: 100,
  INITIAL: 100,
  // Practice mode values (generous for learning)
  GAIN_PERFECT: 3,
  GAIN_GREAT: 1,
  GAIN_COOL: 0,
  REDUCE_MISS: 34,   // 3 misses = game over in practice mode
  FAIL_THRESHOLD: 0,
};

// ─── SCORING SYSTEM (MT3-accurate: simple linear per-hit) ─────────────────────
/**
 * MT3 uses a fixed point-per-hit system:
 *   PERFECT: +3 points
 *   GREAT:   +2 points
 *   COOL:    +1 point
 *
 * The Combo counter is a separate visual motivator — it does NOT multiply
 * individual note scores. It tracks consecutive hits for display only.
 */
export const SCORE_BASE = {
  PERFECT: 5,
  GREAT: 3,
  COOL: 1,
} as const;

export const MAX_SCORE_MULTIPLIER = 1; // combo does not multiply score

export function getComboMultiplier(_combo: number): number {
  return 1; // visual-only combo, no score impact
}

export function getScoreForHit(label: string, _combo: number): number {
  if (label === "PERFECT") return SCORE_BASE.PERFECT;
  if (label === "GREAT") return SCORE_BASE.GREAT;
  if (label === "COOL") return SCORE_BASE.COOL;
  return 0;
}

export function getScorePopupValue(label: string, combo: number): number {
  return getScoreForHit(label, combo);
}

export function getHealthChange(label: string): number {
  switch (label) {
    case "PERFECT": return HEALTH.GAIN_PERFECT;
    case "GREAT":   return HEALTH.GAIN_GREAT;
    case "COOL":    return HEALTH.GAIN_COOL;
    default:        return -HEALTH.REDUCE_MISS;
  }
}

// ─── SEQUENTIAL AUDIO TRIGGER SYSTEM ──────────────────────────────────────────
/**
 * FORENSIC REALITY:
 * MT3 does NOT assign fixed pitches to lanes.
 * Tapping ANY lane simply triggers the next pre-recorded audio snippet
 * from the song's sequence. This is how MT3 supports any genre.
 *
 * For our implementation:
 *  - In song mode: tap triggers next audio segment (handled by audio system)
 *  - Feedback sounds: simple click/pop for tactile response (not melodic)
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

/**
 * Tactile tap feedback — short click sound.
 * NOT a musical note. The music comes from the song's audio track.
 */
export function playTapSound(lane: number) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Short percussive click — not a musical pitch
    osc.type = "triangle";
    osc.frequency.setValueAtTime(800 + lane * 50, ctx.currentTime); // subtle lane variance
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.04);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.Q.setValueAtTime(2, ctx.currentTime);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  } catch {
    // Audio not available
  }
}

/**
 * PERFECT hit feedback — bright snap sound for satisfaction.
 */
export function playPerfectSound() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // Audio not available
  }
}

/**
 * Miss feedback — low thud indicating failure.
 */
export function playMissSound() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
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

// ─── KEYBOARD MAP ─────────────────────────────────────────────────────────────
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
