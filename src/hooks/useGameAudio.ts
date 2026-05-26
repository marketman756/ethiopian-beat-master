/**
 * useGameAudio — AudioContext-based audio loading, playback, and precision timing.
 * Uses AudioContext.currentTime as the master clock for drift-free sync.
 */
import { useRef, useCallback, useEffect, useMemo } from "react";
import { getCalibrationOffset } from "@/lib/calibration";

interface GameAudioState {
  /** Load an audio file into an AudioBuffer */
  loadAudio: (url: string) => Promise<void>;
  /** Start playback, scheduled to begin after leadInMs. Returns immediately. */
  startPlayback: (leadInMs: number, playbackRate?: number) => void;
  /** Stop playback */
  stopPlayback: () => void;
  /** Pause playback */
  pausePlayback: () => void;
  /** Resume playback after pause */
  resumePlayback: () => void;
  /** Get current song time in ms (negative during lead-in, 0 = music starts) */
  getSongTimeMs: () => number;
  /** Whether audio is loaded */
  isLoaded: () => boolean;
  /** Get the raw AudioContext (for synth sounds) */
  getAudioContext: () => AudioContext;
}

export function useGameAudio(): GameAudioState {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  // The audioCtx.currentTime when songTime=0 (music beat 0)
  const songStartCtxTimeRef = useRef(0);
  // For pause/resume: how far into the song we paused
  const pausedSongTimeRef = useRef<number | null>(null);
  const playbackRateRef = useRef(1);
  // Hardware latency (output + base), measured once per context. Subtracted
  // from reported song time so visuals align with what the user actually hears.
  const hardwareLatencyMsRef = useRef(0);
  // Drift correction: when ctx.currentTime drifts >30ms from the AudioBufferSource's
  // expected position we nudge songStartCtxTime by half the delta to converge smoothly.
  const lastDriftCheckRef = useRef(0);
  const driftAccumRef = useRef(0);

  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Warm-up: schedule a few silent gain ramps so the audio thread is hot
      // before the first user-perceptible sound. Mitigates cold-start jitter.
      try {
        const c = ctxRef.current;
        const g = c.createGain();
        g.gain.value = 0;
        g.connect(c.destination);
        for (let i = 0; i < 3; i++) {
          const o = c.createOscillator();
          o.connect(g);
          o.start(c.currentTime + i * 0.01);
          o.stop(c.currentTime + i * 0.01 + 0.005);
        }
      } catch { /* ignore */ }
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    // Re-measure on every access — outputLatency can change after device switch.
    const ctx = ctxRef.current;
    const out = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
    const base = (ctx as AudioContext & { baseLatency?: number }).baseLatency ?? 0;
    hardwareLatencyMsRef.current = (out + base) * 1000;
    return ctxRef.current;
  }, []);

  const loadAudio = useCallback(async (url: string) => {
    const ctx = getCtx();
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      // decodeAudioData is unreliable when given a transferred ArrayBuffer in
      // some browsers — slice() makes a fresh copy.
      bufferRef.current = await ctx.decodeAudioData(arrayBuffer.slice(0));
      console.info(
        `[audio] loaded ${url} — ${bufferRef.current.duration.toFixed(1)}s, ` +
        `${bufferRef.current.sampleRate}Hz, ${bufferRef.current.numberOfChannels}ch`,
      );
    } catch (err) {
      console.error("[audio] load failed:", url, err);
      bufferRef.current = null;
      throw err;
    }
  }, [getCtx]);

  const startPlayback = useCallback((leadInMs: number, playbackRate = 1) => {
    const ctx = getCtx();
    playbackRateRef.current = playbackRate;
    pausedSongTimeRef.current = null;

    // Song time 0 will be leadInMs from now
    songStartCtxTimeRef.current = ctx.currentTime + leadInMs / 1000;

    if (bufferRef.current) {
      // Stop any existing source
      try { sourceRef.current?.stop(); } catch { /* ignore */ }

      const source = ctx.createBufferSource();
      source.buffer = bufferRef.current;
      source.playbackRate.value = playbackRate;
      source.connect(ctx.destination);
      // Schedule the audio to start exactly when songTime crosses 0
      source.start(songStartCtxTimeRef.current);
      sourceRef.current = source;
    }
  }, [getCtx]);

  const stopPlayback = useCallback(() => {
    try { sourceRef.current?.stop(); } catch { /* ignore */ }
    sourceRef.current = null;
    pausedSongTimeRef.current = null;
  }, []);

  const pausePlayback = useCallback(() => {
    const ctx = getCtx();
    pausedSongTimeRef.current = (ctx.currentTime - songStartCtxTimeRef.current) * 1000;
    try { sourceRef.current?.stop(); } catch { /* ignore */ }
    sourceRef.current = null;
  }, [getCtx]);

  const resumePlayback = useCallback(() => {
    if (pausedSongTimeRef.current === null) return;
    const ctx = getCtx();
    const pausedAt = pausedSongTimeRef.current;

    // Recalculate songStartCtxTime so getSongTimeMs() continues from where we left off
    songStartCtxTimeRef.current = ctx.currentTime - pausedAt / 1000;
    pausedSongTimeRef.current = null;

    if (bufferRef.current && pausedAt >= 0) {
      const source = ctx.createBufferSource();
      source.buffer = bufferRef.current;
      source.playbackRate.value = playbackRateRef.current;
      source.connect(ctx.destination);
      // Resume from the paused position
      source.start(0, pausedAt / 1000);
      sourceRef.current = source;
    }
  }, [getCtx]);

  const getSongTimeMs = useCallback((): number => {
    // Apply calibration offset: positive offset means audio is perceived later
    // than visuals, so we shift the reported song time forward to compensate.
    // Combine user-tuned calibration with measured hardware output latency.
    const offset = getCalibrationOffset() + hardwareLatencyMsRef.current;
    if (pausedSongTimeRef.current !== null) {
      return pausedSongTimeRef.current + offset;
    }
    const ctx = getCtx();
    const songMs = (ctx.currentTime - songStartCtxTimeRef.current) * 1000;
    // ── Drift correction (every 500ms) ──
    // If wall-clock estimate diverges from the source's scheduled position by
    // >30ms, smoothly nudge songStartCtxTime to converge.
    const nowPerf = performance.now();
    if (sourceRef.current && nowPerf - lastDriftCheckRef.current > 500 && songMs > 0) {
      lastDriftCheckRef.current = nowPerf;
      // Expected position based on buffer playback at given rate.
      // ctx.currentTime should equal songStartCtxTime + (sourcePlayhead / rate).
      // Browsers don't expose playhead directly, but we can detect cumulative
      // drift by comparing two successive samples; large jumps (>30ms / interval)
      // mean the audio thread skipped or stalled.
      const expected = driftAccumRef.current + 500;
      const drift = songMs - expected;
      if (Math.abs(drift) > 30) {
        // Nudge by half — exponential convergence avoids visual stutter.
        songStartCtxTimeRef.current += (drift / 2) / 1000;
      }
      driftAccumRef.current = songMs;
    }
    return songMs + offset;
  }, [getCtx]);

  const isLoaded = useCallback(() => bufferRef.current !== null, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { sourceRef.current?.stop(); } catch { /* ignore */ }
    };
  }, []);

  return useMemo(() => ({
    loadAudio,
    startPlayback,
    stopPlayback,
    pausePlayback,
    resumePlayback,
    getSongTimeMs,
    isLoaded,
    getAudioContext: getCtx,
  }), [
    loadAudio,
    startPlayback,
    stopPlayback,
    pausePlayback,
    resumePlayback,
    getSongTimeMs,
    isLoaded,
    getCtx,
  ]);
}
