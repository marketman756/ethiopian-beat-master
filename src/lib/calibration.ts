/**
 * Calibration — persistent audio/visual latency offset.
 *
 * Positive offset (ms) means: "the audio reaches my ears LATER than the
 * visual hit-line. Treat my taps as if they happened earlier" — i.e. we
 * SUBTRACT the offset from the perceived song time so that hitting a tile
 * exactly when it crosses the line is registered as PERFECT.
 *
 * Range is intentionally clamped to ±200ms; anything beyond that is almost
 * certainly a device/driver problem rather than a calibration issue.
 */

const STORAGE_KEY = "ethio-tiles.calibration-offset-ms";
const MIN_OFFSET = -200;
const MAX_OFFSET = 200;

let cached: number | null = null;

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, value));
}

/** Read the user's calibration offset in milliseconds (cached after first read). */
export function getCalibrationOffset(): number {
  if (cached !== null) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cached = raw === null ? 0 : clamp(parseFloat(raw));
  } catch {
    cached = 0;
  }
  return cached;
}

/** Persist a new calibration offset (clamped). */
export function setCalibrationOffset(offsetMs: number): number {
  const next = clamp(Math.round(offsetMs));
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* storage unavailable — keep in-memory value */
  }
  return next;
}

export const CALIBRATION_RANGE = { min: MIN_OFFSET, max: MAX_OFFSET } as const;
