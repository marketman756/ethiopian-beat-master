import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  CALIBRATION_RANGE,
  getCalibrationOffset,
  setCalibrationOffset,
} from "@/lib/calibration";
import { Settings as SettingsIcon, Volume2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

/**
 * Phase 4 — Calibration & Settings.
 * Plays a steady metronome via AudioContext and lets the user tap along.
 * Median (tap_time - nearest_beat) becomes the calibration offset (ms).
 * Positive offset = audio is late vs visual → subtract from song time.
 */
const BPM = 100;
const BEAT_INTERVAL_MS = 60_000 / BPM;

const Settings = () => {
  const [offset, setOffset] = useState<number>(() => getCalibrationOffset());
  const [running, setRunning] = useState(false);
  const [taps, setTaps] = useState<number[]>([]);
  const [pulse, setPulse] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef<number>(0);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { stopRef.current?.(); }, []);

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    setRunning(false);
  };

  const start = async () => {
    setTaps([]);
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    await ctx.resume();
    ctxRef.current = ctx;
    const startAt = ctx.currentTime + 0.2;
    startTimeRef.current = startAt;

    const beats = 16;
    for (let i = 0; i < beats; i++) {
      const t = startAt + i * (BEAT_INTERVAL_MS / 1000);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = i % 4 === 0 ? 1200 : 800;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    }

    setRunning(true);

    let raf = 0;
    const tick = () => {
      const now = ctx.currentTime - startAt;
      const beatIdx = Math.floor(now / (BEAT_INTERVAL_MS / 1000));
      setPulse(beatIdx);
      if (beatIdx >= beats) {
        cancelAnimationFrame(raf);
        stop();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    stopRef.current = () => {
      cancelAnimationFrame(raf);
      try { ctx.close(); } catch {}
    };
  };

  const handleTap = () => {
    if (!running || !ctxRef.current) return;
    const elapsedMs = (ctxRef.current.currentTime - startTimeRef.current) * 1000;
    const nearest = Math.round(elapsedMs / BEAT_INTERVAL_MS) * BEAT_INTERVAL_MS;
    const delta = elapsedMs - nearest; // positive = tapped late
    setTaps((t) => [...t, delta]);
  };

  const applyMeasured = () => {
    if (taps.length < 4) {
      toast.error("Tap along to at least 4 beats first");
      return;
    }
    const sorted = [...taps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const next = setCalibrationOffset(median);
    setOffset(next);
    toast.success(`Calibration set to ${next}ms`);
  };

  const reset = () => {
    const next = setCalibrationOffset(0);
    setOffset(next);
    toast.success("Calibration reset");
  };

  const save = () => {
    const next = setCalibrationOffset(offset);
    setOffset(next);
    toast.success(`Saved offset: ${next}ms`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10 max-w-3xl">
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Audio Calibration</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            If tiles feel early or late, calibrate your device. Tap along with the
            metronome — we'll measure your average offset and apply it.
          </p>

          <div className="rounded-lg border p-6 space-y-4 bg-secondary/30">
            <div className="flex items-center justify-center">
              <div
                className={`h-24 w-24 rounded-full transition-all duration-75 ${
                  running && pulse % 1 === 0 ? "scale-110" : "scale-90"
                } bg-primary/80`}
                style={{ boxShadow: running ? "0 0 40px hsl(var(--primary))" : "none" }}
              />
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {!running ? (
                <Button onClick={start}>Start metronome</Button>
              ) : (
                <Button variant="secondary" onClick={stop}>Stop</Button>
              )}
              <Button
                variant="outline"
                disabled={!running}
                onClick={handleTap}
                className="min-w-32"
              >
                Tap (taps: {taps.length})
              </Button>
              <Button onClick={applyMeasured} disabled={taps.length < 4}>
                Apply measured
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Manual offset</label>
              <span className="font-mono tabular-nums text-sm">{offset} ms</span>
            </div>
            <Slider
              value={[offset]}
              min={CALIBRATION_RANGE.min}
              max={CALIBRATION_RANGE.max}
              step={1}
              onValueChange={(v) => setOffset(v[0])}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={save}>
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reset to 0
              </Button>
            </div>
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Settings;