/**
 * onsetChart — derive a beat-mapped chart from real audio.
 *
 * Uses an OfflineAudioContext to fully decode + analyze the song, then
 * runs a lightweight spectral-flux onset detector across two frequency
 * bands (low = kick/bass, high = snare/vocal transients).
 *
 * Output is a `ChartNote[]` aligned to actual musical events instead of
 * a fixed BPM grid — this is what makes taps "produce the music".
 *
 * Design constraints:
 *   - Pure DSP, zero deps. Runs once on load (cached for the session).
 *   - Worst-case ~5 minute song decodes in <1.5s on a modern phone; we
 *     down-mix to mono and use a 22050 Hz sample rate for the analysis.
 *   - Falls back gracefully (returns null) — caller keeps existing chart.
 */

import type { ChartNote, TileType } from "./tileCharts";

const ANALYSIS_SR = 22050;          // analysis sample rate
const FFT_SIZE = 1024;              // ~46ms window at 22050
const HOP = 512;                    // 50% overlap → ~23ms frames
const MIN_GAP_MS = 140;             // refractory period between onsets per band
const PEAK_WINDOW = 6;              // local-max window (frames)
const FLUX_THRESHOLD_MULT = 1.45;   // peak must exceed running mean × this
const SIMULTANEOUS_MS = 55;         // onsets within this window → chord/double
const HOLD_MIN_MS = 320;            // sustained energy below this → tap, not hold
const HOLD_MAX_MS = 1800;           // cap a single hold tile length
const SILENCE_RMS = 0.012;          // frames below this RMS count as silence

interface RawOnset {
  timeMs: number;
  band: "low" | "mid" | "high";
  strength: number;
  /** Spectral centroid (Hz) of the frame — used to bucket pitch → lane. */
  centroidHz: number;
  /** Frame index in the analysis grid — used for sustain lookup. */
  frame: number;
}

/** Per-frame RMS + centroid arrays, kept so onsetsToChart can detect sustain/silence. */
interface AnalysisFrames {
  rms: Float32Array;
  centroidHz: Float32Array;
  frameMs: number;
}

let lastFrames: AnalysisFrames | null = null;

/**
 * Build a chart from a decoded audio URL. Returns null on failure so the
 * caller can fall back to its bundled chart.
 */
export async function buildChartFromAudio(
  url: string,
  bpm: number,
): Promise<ChartNote[] | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();

    // Decode at analysis sample rate via OfflineAudioContext for speed
    const tmpCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const decoded = await tmpCtx.decodeAudioData(arrayBuf.slice(0));
    tmpCtx.close().catch(() => {});

    // Downmix to mono Float32
    const mono = downmixToMono(decoded);
    const resampled = resample(mono, decoded.sampleRate, ANALYSIS_SR);

    const onsets = detectOnsets(resampled, ANALYSIS_SR);
    if (onsets.length < 16) return null;

    return onsetsToChart(onsets, bpm);
  } catch (e) {
    console.warn("[onsetChart] analysis failed:", e);
    return null;
  }
}

function downmixToMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice();
  const len = buf.length;
  const out = new Float32Array(len);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) out[i] += data[i];
  }
  const inv = 1 / buf.numberOfChannels;
  for (let i = 0; i < len; i++) out[i] *= inv;
  return out;
}

/** Linear resample; quality is fine for onset detection. */
function resample(input: Float32Array, fromSR: number, toSR: number): Float32Array {
  if (fromSR === toSR) return input;
  const ratio = fromSR / toSR;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const frac = srcIdx - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

/**
 * Spectral-flux onset detection across two bands.
 * Naive radix-2 FFT (we only need magnitudes) — sufficient for FFT_SIZE=1024.
 */
function detectOnsets(samples: Float32Array, sr: number): RawOnset[] {
  const numFrames = Math.max(0, Math.floor((samples.length - FFT_SIZE) / HOP));
  if (numFrames < 4) return [];

  const window = hann(FFT_SIZE);
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);

  // Frequency bins: low = 40–250 Hz (kick/bass), mid = 250–2k (vocals/melody), high = 2k–8k (snare/cymbal/sibilants)
  const binHz = sr / FFT_SIZE;
  const lowLo = Math.floor(40 / binHz);
  const lowHi = Math.floor(250 / binHz);
  const midLo = lowHi + 1;
  const midHi = Math.floor(2000 / binHz);
  const highLo = midHi + 1;
  const highHi = Math.floor(8000 / binHz);

  const fluxLow = new Float32Array(numFrames);
  const fluxMid = new Float32Array(numFrames);
  const fluxHigh = new Float32Array(numFrames);
  const rms = new Float32Array(numFrames);
  const centroid = new Float32Array(numFrames);
  let prevMagLow: Float32Array | null = null;
  let prevMagMid: Float32Array | null = null;
  let prevMagHigh: Float32Array | null = null;

  for (let f = 0; f < numFrames; f++) {
    const start = f * HOP;
    let frameSq = 0;
    for (let i = 0; i < FFT_SIZE; i++) {
      const s = samples[start + i];
      frameSq += s * s;
      re[i] = s * window[i];
      im[i] = 0;
    }
    rms[f] = Math.sqrt(frameSq / FFT_SIZE);
    fft(re, im);

    const magLow = new Float32Array(lowHi - lowLo + 1);
    const magMid = new Float32Array(midHi - midLo + 1);
    const magHigh = new Float32Array(highHi - highLo + 1);
    for (let k = lowLo; k <= lowHi; k++) magLow[k - lowLo] = Math.hypot(re[k], im[k]);
    for (let k = midLo; k <= midHi; k++) magMid[k - midLo] = Math.hypot(re[k], im[k]);
    for (let k = highLo; k <= highHi; k++) magHigh[k - highLo] = Math.hypot(re[k], im[k]);

    // Spectral centroid across the full analyzed range (low+mid+high) — proxies pitch.
    let cNum = 0, cDen = 0;
    for (let k = lowLo; k <= highHi; k++) {
      const m = Math.hypot(re[k], im[k]);
      cNum += k * binHz * m;
      cDen += m;
    }
    centroid[f] = cDen > 1e-9 ? cNum / cDen : 0;

    if (prevMagLow) {
      let sum = 0;
      for (let i = 0; i < magLow.length; i++) {
        const d = magLow[i] - prevMagLow[i];
        if (d > 0) sum += d;
      }
      fluxLow[f] = sum;
    }
    if (prevMagMid) {
      let sum = 0;
      for (let i = 0; i < magMid.length; i++) {
        const d = magMid[i] - prevMagMid[i];
        if (d > 0) sum += d;
      }
      fluxMid[f] = sum;
    }
    if (prevMagHigh) {
      let sum = 0;
      for (let i = 0; i < magHigh.length; i++) {
        const d = magHigh[i] - prevMagHigh[i];
        if (d > 0) sum += d;
      }
      fluxHigh[f] = sum;
    }
    prevMagLow = magLow;
    prevMagMid = magMid;
    prevMagHigh = magHigh;
  }

  const frameMs = (HOP / sr) * 1000;
  lastFrames = { rms, centroidHz: centroid, frameMs };
  const onsets: RawOnset[] = [];
  pickPeaks(fluxLow, frameMs, "low", centroid, onsets);
  pickPeaks(fluxMid, frameMs, "mid", centroid, onsets);
  pickPeaks(fluxHigh, frameMs, "high", centroid, onsets);
  onsets.sort((a, b) => a.timeMs - b.timeMs);
  return onsets;
}

function pickPeaks(
  flux: Float32Array,
  frameMs: number,
  band: "low" | "mid" | "high",
  centroid: Float32Array,
  out: RawOnset[],
): void {
  // Adaptive threshold: local mean × multiplier
  const meanWin = 16;
  let lastMs = -Infinity;
  for (let i = PEAK_WINDOW; i < flux.length - PEAK_WINDOW; i++) {
    const v = flux[i];
    if (v <= 0) continue;

    let isMax = true;
    for (let k = 1; k <= PEAK_WINDOW; k++) {
      if (flux[i - k] >= v || flux[i + k] > v) { isMax = false; break; }
    }
    if (!isMax) continue;

    let sum = 0, n = 0;
    for (let k = -meanWin; k <= meanWin; k++) {
      const j = i + k;
      if (j >= 0 && j < flux.length) { sum += flux[j]; n++; }
    }
    const mean = n > 0 ? sum / n : 0;
    if (v < mean * FLUX_THRESHOLD_MULT) continue;

    const timeMs = i * frameMs;
    if (timeMs - lastMs < MIN_GAP_MS) continue;
    lastMs = timeMs;
    out.push({ timeMs, band, strength: v, centroidHz: centroid[i] || 0, frame: i });
  }
}

/** In-place radix-2 Cooley-Tukey FFT (length must be power of two). */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  // Bit-reversal
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) { j -= m; m >>= 1; }
    j += m;
  }
  // Butterflies
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < half; k++) {
        const tRe = curRe * re[i + k + half] - curIm * im[i + k + half];
        const tIm = curRe * im[i + k + half] + curIm * re[i + k + half];
        re[i + k + half] = re[i + k] - tRe;
        im[i + k + half] = im[i + k] - tIm;
        re[i + k] += tRe;
        im[i + k] += tIm;
        const nRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nRe;
      }
    }
  }
}

function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}

/**
 * Map detected onsets to lanes + types — implements the MT3 generation rules:
 *
 *   • PITCH → COLUMN: spectral centroid is bucketed into 4 lanes
 *     (low pitch → lane 0/left, high pitch → lane 3/right). This mirrors a
 *     keyboard so a rising melody walks across the screen left→right.
 *   • SIMULTANEOUS onsets in different bands (within ~55 ms) → DOUBLE tile
 *     spanning two pitch-appropriate lanes (chord / beat+melody hit).
 *   • SUSTAINED energy after an onset (RMS stays above silence for ≥320 ms with
 *     no new onset) → HOLD tile for that duration, capped at HOLD_MAX_MS.
 *   • SILENCE (RMS below SILENCE_RMS) → no tile is emitted; the gap remains
 *     as empty white tiles in the playfield.
 *   • PLAYABILITY: never repeat the same lane back-to-back (nudges by ±1 if
 *     the pitch bucket would collide with the previous tile's lane).
 */
function onsetsToChart(onsets: RawOnset[], _bpm: number): ChartNote[] {
  const notes: ChartNote[] = [];
  const frames = lastFrames;
  let prevLane = -1;

  // Adaptive pitch-bucket bounds from the centroid distribution of all onsets.
  // Using percentiles makes the mapping song-relative rather than fixed Hz.
  const cents = onsets.map((o) => o.centroidHz).filter((c) => c > 0).sort((a, b) => a - b);
  const pct = (p: number) => cents.length ? cents[Math.min(cents.length - 1, Math.floor(cents.length * p))] : 0;
  const q1 = pct(0.25), q2 = pct(0.5), q3 = pct(0.75);

  const pitchToLane = (hz: number, band: RawOnset["band"]): number => {
    if (!cents.length || hz <= 0) {
      // No centroid — fall back to band heuristic
      return band === "low" ? 0 : band === "mid" ? 2 : 3;
    }
    if (hz < q1) return 0;
    if (hz < q2) return 1;
    if (hz < q3) return 2;
    return 3;
  };

  // Sustain probe: starting at frame `f`, how many ms of continuous above-silence
  // energy do we have before the next onset (or before audio drops below SILENCE_RMS)?
  const sustainMsFrom = (fromFrame: number, untilMs: number): number => {
    if (!frames) return 0;
    const { rms, frameMs } = frames;
    const maxFrames = Math.min(rms.length, fromFrame + Math.ceil(untilMs / frameMs));
    let last = fromFrame;
    for (let f = fromFrame + 1; f < maxFrames; f++) {
      if (rms[f] < SILENCE_RMS) break;
      last = f;
    }
    return (last - fromFrame) * frameMs;
  };

  for (let i = 0; i < onsets.length; i++) {
    const o = onsets[i];
    const time = Math.round(o.timeMs);
    const next = onsets[i + 1];
    const gap = next ? next.timeMs - o.timeMs : Infinity;

    // 1) DOUBLE — simultaneous hit in different bands
    if (next && gap < SIMULTANEOUS_MS && next.band !== o.band) {
      const a = pitchToLane(o.centroidHz, o.band);
      let b = pitchToLane(next.centroidHz, next.band);
      if (b === a) b = (a + 2) % 4; // ensure two distinct lanes
      // Avoid repeating prevLane on either lane of the double
      const laneA = a === prevLane ? (a + 1) % 4 : a;
      const laneB = b === prevLane || b === laneA ? [0, 1, 2, 3].find((l) => l !== laneA && l !== prevLane)! : b;
      notes.push({ time, lane: laneA, type: "double", lane2: laneB });
      prevLane = laneB;
      i++; // consume next onset
      continue;
    }

    // 2) HOLD — sustained energy after this onset, longer than HOLD_MIN_MS
    //    and bounded by either the next onset or natural silence.
    const sustain = sustainMsFrom(o.frame, Math.min(gap, HOLD_MAX_MS));
    let lane = pitchToLane(o.centroidHz, o.band);
    if (lane === prevLane) lane = (lane + 1) % 4;

    if (sustain >= HOLD_MIN_MS) {
      const holdDuration = Math.min(Math.round(sustain), HOLD_MAX_MS);
      notes.push({ time, lane, type: "hold", holdDuration });
    } else {
      // 3) TAP — short onset; silence before the next onset is preserved as gap.
      notes.push({ time, lane, type: "tap" });
    }
    prevLane = lane;
  }

  return notes;
}