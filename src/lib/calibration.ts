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
const VISUAL_KEY = "ethio-tiles.visual-offset-ms";
const OUTPUT_KEY = "ethio-tiles.audio-output-kind";
const MIN_OFFSET = -200;
const MAX_OFFSET = 200;

let cached: number | null = null;
let cachedVisual: number | null = null;

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

/** Visual-only offset (ms): how late the rendered frame lands vs the hit-line tick. */
export function getVisualOffset(): number {
  if (cachedVisual !== null) return cachedVisual;
  try {
    const raw = localStorage.getItem(VISUAL_KEY);
    cachedVisual = raw === null ? 0 : clamp(parseFloat(raw));
  } catch { cachedVisual = 0; }
  return cachedVisual;
}

export function setVisualOffset(offsetMs: number): number {
  const next = clamp(Math.round(offsetMs));
  cachedVisual = next;
  try { localStorage.setItem(VISUAL_KEY, String(next)); } catch { /* ignore */ }
  return next;
}

/**
 * Best-effort detection of a Bluetooth audio output, which typically adds
 * 150–300ms of latency that is NOT reported via AudioContext.outputLatency.
 * Returns `"bluetooth" | "wired" | "speaker" | "unknown"`.
 */
export async function detectAudioOutputKind(): Promise<"bluetooth" | "wired" | "speaker" | "unknown"> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return "unknown";
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outs = devices.filter((d) => d.kind === "audiooutput");
    const label = outs.map((d) => d.label.toLowerCase()).join(" | ");
    let kind: "bluetooth" | "wired" | "speaker" | "unknown" = "unknown";
    if (/bluetooth|airpods|wh-|wf-|buds|headset/.test(label)) kind = "bluetooth";
    else if (/headphone|wired|jack/.test(label)) kind = "wired";
    else if (/speaker|default/.test(label)) kind = "speaker";
    try { localStorage.setItem(OUTPUT_KEY, kind); } catch { /* ignore */ }
    return kind;
  } catch { return "unknown"; }
}

/** Suggested extra latency in ms based on detected output kind. */
export function suggestedOffsetForOutputKind(kind: string): number {
  switch (kind) {
    case "bluetooth": return 180;
    case "wired":     return 20;
    case "speaker":   return 40;
    default:          return 0;
  }
}

export const CALIBRATION_RANGE = { min: MIN_OFFSET, max: MAX_OFFSET } as const;
