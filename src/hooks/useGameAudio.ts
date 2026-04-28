/**
 * useGameAudio — AudioContext-based audio loading, playback, and precision timing.
 * Uses AudioContext.currentTime as the master clock for drift-free sync.
 */
import { useRef, useCallback, useEffect } from "react";
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

  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
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
    const offset = getCalibrationOffset();
    if (pausedSongTimeRef.current !== null) {
      return pausedSongTimeRef.current + offset;
    }
    const ctx = getCtx();
    return (ctx.currentTime - songStartCtxTimeRef.current) * 1000 + offset;
  }, [getCtx]);

  const isLoaded = useCallback(() => bufferRef.current !== null, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { sourceRef.current?.stop(); } catch { /* ignore */ }
    };
  }, []);

  return {
    loadAudio,
    startPlayback,
    stopPlayback,
    pausePlayback,
    resumePlayback,
    getSongTimeMs,
    isLoaded,
    getAudioContext: getCtx,
  };
}
