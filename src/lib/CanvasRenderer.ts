/**
 * CanvasRenderer — single-canvas, GPU-friendly playfield painter.
 *
 * Owns one HTMLCanvasElement and renders the entire playfield in one paint
 * per frame: background, lane dividers, hit-line, tiles, hold-bars, hit
 * flash particles, score popups. No layout thrash, no per-tile React diffing.
 *
 * Coordinates are normalized to a logical (cssWidth × cssHeight) space and
 * scaled by devicePixelRatio internally so high-DPI screens stay crisp.
 */

import { GameTile, HitEffect } from "./gameEngine";

export const NEON_CYAN = "#00f2ff";
export const NEON_MAGENTA = "#ff007a";
export const NEON_GOLD = "#ffd700";
export const TILE_BLACK = "#0a0a0a";
export const HIT_ZONE_RATIO = 0.82;

export interface RenderState {
  tiles: GameTile[];
  hitEffects: HitEffect[];
  scorePopups: { id: number; lane: number; value: number; timestamp: number }[];
  combo: number;
  beatPhase: number;          // 0..1 within the current beat for pulse
  tileHeightFrac: number;     // 0..1 of canvas height — derived from BPM/fall
  laneFlash: number[];        // length 4, 0..1 brightness per lane (decays)
  starsEarned: 0 | 1 | 2 | 3;
}

const LANES = 4;

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private cssWidth = 0;
  private cssHeight = 0;
  private resizeObserver?: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) throw new Error("CanvasRenderer: 2D context unavailable");
    this.ctx = ctx;
    this.handleResize();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
  }

  private handleResize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssWidth = Math.max(1, rect.width);
    this.cssHeight = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /** Public dimensions (CSS px) — useful for input → lane mapping. */
  get width(): number { return this.cssWidth; }
  get height(): number { return this.cssHeight; }

  render(state: RenderState): void {
    const { ctx } = this;
    const W = this.cssWidth;
    const H = this.cssHeight;

    // ── Background: deep radial neon void ──
    const bgGrad = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, Math.max(W, H));
    bgGrad.addColorStop(0, "#15052a");
    bgGrad.addColorStop(0.45, "#0a0118");
    bgGrad.addColorStop(1, "#000000");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle mesh-gradient blobs (cheap fixed positions)
    this.paintBlob(W * 0.18, H * 0.22, W * 0.55, "rgba(0,242,255,0.08)");
    this.paintBlob(W * 0.85, H * 0.62, W * 0.55, "rgba(255,0,122,0.07)");

    // ── Lane dividers ──
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i < LANES; i++) {
      const x = (W / LANES) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // ── Lane flash glow (fades after tap) ──
    for (let i = 0; i < LANES; i++) {
      const f = state.laneFlash[i] ?? 0;
      if (f <= 0.01) continue;
      const x = (W / LANES) * i;
      const w = W / LANES;
      const grad = ctx.createLinearGradient(0, H * HIT_ZONE_RATIO, 0, H);
      grad.addColorStop(0, `rgba(0,242,255,${0.45 * f})`);
      grad.addColorStop(1, "rgba(0,242,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, H * (HIT_ZONE_RATIO - 0.05), w, H * 0.23);
    }

    // ── Hit line (pulses with beat) ──
    const hy = H * HIT_ZONE_RATIO;
    const pulse = 1 - Math.min(1, state.beatPhase * 4); // sharp fade across first quarter beat
    const lineAlpha = 0.18 + 0.35 * Math.max(0, pulse);
    ctx.save();
    ctx.shadowColor = NEON_CYAN;
    ctx.shadowBlur = 12 + 16 * Math.max(0, pulse);
    ctx.strokeStyle = `rgba(0,242,255,${lineAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, hy);
    ctx.lineTo(W, hy);
    ctx.stroke();
    ctx.restore();

    // ── Tiles ──
    const tileH = state.tileHeightFrac * H;
    const laneW = W / LANES;
    const gap = Math.max(2, laneW * 0.02);

    for (const t of state.tiles) {
      if (t.hit && t.type !== "hold") continue;
      if (t.type === "hold" && t.holdComplete) continue;

      this.paintTile(t, t.lane, laneW, gap, H, tileH, state.combo);
      if (t.type === "double" && t.lane2 !== undefined && !t.hit2) {
        this.paintTile(t, t.lane2, laneW, gap, H, tileH, state.combo);
      }
    }

    // ── Hit feedback labels (PERFECT / GREAT / COOL) ──
    const now = performance.now();
    for (const fx of state.hitEffects) {
      const age = now - fx.timestamp;
      if (age > 500) continue;
      const t = age / 500;
      const alpha = 1 - t;
      const yOffset = -40 * t;
      const scale = 0.7 + 0.5 * Math.min(1, t * 4);

      const color =
        fx.label === "PERFECT" ? NEON_GOLD :
        fx.label === "GREAT" ? NEON_CYAN :
        "#ffffff";

      ctx.save();
      ctx.translate(W / 2, H * 0.45 + yOffset);
      ctx.scale(scale, scale);
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.font = "900 26px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fx.label, 0, 0);
      ctx.restore();
    }

    // ── Score popups (+2, +3, +4) ──
    for (const p of state.scorePopups) {
      const age = now - p.timestamp;
      if (age > 600) continue;
      const t = age / 600;
      const alpha = 1 - t;
      const yOffset = -28 * t;
      const x = laneW * p.lane + laneW / 2;
      const y = H * 0.74 + yOffset;

      ctx.save();
      ctx.shadowColor = NEON_GOLD;
      ctx.shadowBlur = 10;
      ctx.fillStyle = `rgba(255,215,0,${alpha})`;
      ctx.font = "900 16px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`+${p.value}`, x, y);
      ctx.restore();
    }
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  private paintBlob(cx: number, cy: number, radius: number, color: string): void {
    const { ctx } = this;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  private paintTile(
    t: GameTile,
    lane: number,
    laneW: number,
    gap: number,
    H: number,
    tileH: number,
    combo: number,
  ): void {
    const { ctx } = this;
    const x = laneW * lane + gap / 2;
    const w = laneW - gap;
    const y = (t.y / 100) * H;

    if (t.type === "hold") {
      const holdH = (t.holdHeight / 100) * H;
      this.paintHoldTile(x, y, w, holdH, t.holding);
      return;
    }

    // Tap / double tile body
    const goldStreak = combo > 25;
    const edgeColor = goldStreak ? NEON_GOLD : NEON_CYAN;

    // Body
    ctx.fillStyle = TILE_BLACK;
    this.roundRect(x, y, w, tileH, 6);
    ctx.fill();

    // Inner highlight (top sheen)
    const sheen = ctx.createLinearGradient(0, y, 0, y + tileH);
    sheen.addColorStop(0, "rgba(255,255,255,0.14)");
    sheen.addColorStop(0.4, "rgba(255,255,255,0.02)");
    sheen.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sheen;
    this.roundRect(x, y, w, tileH, 6);
    ctx.fill();

    // Neon edge — only when tile is in the input window (near hit line)
    const distToHit = Math.abs(t.y - 82);
    if (distToHit < 18) {
      const intensity = 1 - distToHit / 18;
      ctx.save();
      ctx.shadowColor = edgeColor;
      ctx.shadowBlur = 10 * intensity;
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 1.5;
      this.roundRect(x + 0.75, y + 0.75, w - 1.5, tileH - 1.5, 5.5);
      ctx.stroke();
      ctx.restore();
    }
  }

  private paintHoldTile(x: number, y: number, w: number, h: number, active: boolean): void {
    const { ctx } = this;
    const color = active ? NEON_MAGENTA : "#a8005a";

    // Body gradient
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, active ? "#ff3399" : "#7a0044");
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    this.roundRect(x, y, w, h, 6);
    ctx.fill();

    // Glow when active
    if (active) {
      ctx.save();
      ctx.shadowColor = NEON_MAGENTA;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5;
      this.roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, 5.5);
      ctx.stroke();
      ctx.restore();
    }

    // Release circle near bottom
    const cx = x + w / 2;
    const cy = y + h - 12;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = active ? "white" : "rgba(255,255,255,0.55)";
    if (active) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fill();
    }
    ctx.stroke();
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }
}