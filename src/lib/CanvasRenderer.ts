/**
 * CanvasRenderer — MT3-accurate playfield painter.
 *
 * Forensic accuracy from video frame analysis (112 frames):
 *  - Colorful gradient bg with geometric diamond overlays, shifts through song
 *  - Pure black tiles, sharp corners, no border
 *  - Thin white lane dividers (full height, ~15% opacity)
 *  - Hold tiles: dark navy body, white centerline, cyan rounded cap when active
 *  - Score: large centered white text at ~15% from top
 *  - "PERFECT" with pink-gradient text, combo "×N" to the right
 *  - "+2"/"+4" score popups at bottom of the relevant lane
 *  - Progress bar with stars/crowns at top
 *  - "SPLENDID" text on song completion
 */

import { GameTile, HitEffect } from "./gameEngine";

export const NEON_CYAN = "#00f2ff";
export const NEON_MAGENTA = "#ff007a";
export const NEON_GOLD = "#ffd700";
export const TILE_BLACK = "#000000";
export const HIT_ZONE_RATIO = 0.87;

// MT3 background color phases (observed from video)
const BG_PHASES = [
  { from: [100, 180, 255], to: [180, 120, 255] },   // light blue → purple
  { from: [180, 120, 255], to: [50, 200, 80] },      // purple → green
  { from: [50, 200, 80], to: [255, 210, 50] },       // green → gold
  { from: [255, 210, 50], to: [240, 100, 180] },     // gold → pink
];

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  born: number; life: number;
}

export interface RenderState {
  tiles: GameTile[];
  hitEffects: HitEffect[];
  scorePopups: { id: number; lane: number; value: number; timestamp: number }[];
  combo: number;
  beatPhase: number;
  tileHeightFrac: number;
  laneFlash: number[];
  starsEarned: 0 | 1 | 2 | 3;
  songProgress?: number;
}

const LANES = 4;

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private cssWidth = 0;
  private cssHeight = 0;
  private resizeObserver?: ResizeObserver;
  private particles: Particle[] = [];
  private confetti: Particle[] = [];
  private missFlashAlpha = 0;
  private shakeUntil = 0;
  private speedUpBannerAlpha = 0;
  private speedUpBannerTime = 0;
  private lastConfettiSpawn = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) throw new Error("CanvasRenderer: 2D context unavailable");
    this.ctx = ctx;
    this.handleResize();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);
  }

  destroy(): void { this.resizeObserver?.disconnect(); }

  private handleResize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssWidth = Math.max(1, rect.width);
    this.cssHeight = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  get width(): number { return this.cssWidth; }
  get height(): number { return this.cssHeight; }

  /** Spawn diamond particles at the hit feedback text area */
  spawnParticles(lane: number): void {
    const W = this.cssWidth;
    const H = this.cssHeight;
    const cx = W / 2;
    const cy = H * 0.20;
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        size: 3 + Math.random() * 4,
        born: performance.now(),
        life: 300 + Math.random() * 200,
      });
    }
  }

  triggerMissFlash(): void {
    this.missFlashAlpha = 0.25;
    this.shakeUntil = performance.now() + 150;
  }

  /** MT3: golden "SPEED UP" banner with chevrons */
  triggerSpeedUp(): void {
    this.speedUpBannerAlpha = 1;
    this.speedUpBannerTime = performance.now();
  }

  private getBgColors(progress: number): [number, number, number] {
    const p = Math.max(0, Math.min(0.999, progress));
    const totalPhases = BG_PHASES.length;
    const idx = Math.floor(p * totalPhases);
    const t = (p * totalPhases) - idx;
    const phase = BG_PHASES[idx];
    return [
      Math.round(phase.from[0] + (phase.to[0] - phase.from[0]) * t),
      Math.round(phase.from[1] + (phase.to[1] - phase.from[1]) * t),
      Math.round(phase.from[2] + (phase.to[2] - phase.from[2]) * t),
    ];
  }

  render(state: RenderState): void {
    const { ctx } = this;
    const W = this.cssWidth;
    const H = this.cssHeight;
    const now = performance.now();

    // Screen shake
    let shakeX = 0, shakeY = 0;
    if (now < this.shakeUntil) {
      shakeX = (Math.random() - 0.5) * 10;
      shakeY = (Math.random() - 0.5) * 10;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // ── Background: colorful gradient + geometric diamonds ──
    const progress = state.songProgress ?? 0;
    const [br, bg, bb] = this.getBgColors(progress);

    // Two-tone gradient (top-left lighter, bottom-right darker)
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    const lighter = `rgb(${Math.min(255, br + 30)},${Math.min(255, bg + 30)},${Math.min(255, bb + 30)})`;
    const darker = `rgb(${Math.max(0, br - 40)},${Math.max(0, bg - 40)},${Math.max(0, bb - 40)})`;
    bgGrad.addColorStop(0, lighter);
    bgGrad.addColorStop(0.5, `rgb(${br},${bg},${bb})`);
    bgGrad.addColorStop(1, darker);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // Geometric diamond overlays (MT3 signature look)
    this.paintDiamondOverlay(W, H, progress);

    // Subtle horizontal glow band at hit zone
    const glowGrad = ctx.createLinearGradient(0, H * HIT_ZONE_RATIO - 20, 0, H * HIT_ZONE_RATIO + 20);
    glowGrad.addColorStop(0, "rgba(255,255,255,0)");
    glowGrad.addColorStop(0.5, "rgba(255,255,255,0.12)");
    glowGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, H * HIT_ZONE_RATIO - 20, W, 40);

    // ── Lane dividers: thin white lines, full height (MT3-accurate) ──
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 1; i < LANES; i++) {
      const x = (W / LANES) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // ── Lane flash (white flash from hit line upward on tap) ──
    for (let i = 0; i < LANES; i++) {
      const f = state.laneFlash[i] ?? 0;
      if (f <= 0.01) continue;
      const x = (W / LANES) * i;
      const w = W / LANES;
      const grad = ctx.createLinearGradient(0, H * HIT_ZONE_RATIO, 0, 0);
      grad.addColorStop(0, `rgba(255,255,255,${0.30 * f})`);
      grad.addColorStop(0.4, `rgba(255,255,255,${0.08 * f})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, w, H * HIT_ZONE_RATIO);
    }

    // ── Hit line: subtle white glow bar ──
    const hy = H * HIT_ZONE_RATIO;
    ctx.save();
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, hy);
    ctx.lineTo(W, hy);
    ctx.stroke();
    ctx.restore();

    // ── Tiles ──
    const tileH = state.tileHeightFrac * H;
    const laneW = W / LANES;
    const gap = 2;

    for (const t of state.tiles) {
      if (t.hit && t.type !== "hold") continue;
      if (t.type === "hold" && t.holdComplete) continue;
      this.paintTile(t, t.lane, laneW, gap, H, tileH);
      if (t.type === "double" && t.lane2 !== undefined && !t.hit2) {
        this.paintTile(t, t.lane2, laneW, gap, H, tileH);
      }
    }

    // ── Hit feedback: centered "PERFECT" with combo ×N (MT3-accurate) ──
    for (const fx of state.hitEffects) {
      const age = now - fx.timestamp;
      if (age > 450) continue;
      const t = age / 450;
      const alpha = t < 0.7 ? 1 : 1 - ((t - 0.7) / 0.3);
      const yOff = -20 * t;

      // Pop scale: 0.6→1.15→1.0
      let sc: number;
      if (t < 0.1) sc = 0.6 + (0.55 / 0.1) * t;
      else sc = 1.15 - 0.15 * Math.min(1, (t - 0.1) / 0.25);

      const isMiss = fx.label === "MISS";

      ctx.save();
      ctx.translate(W / 2, H * 0.18 + yOff);
      ctx.scale(sc, sc);
      ctx.globalAlpha = alpha;

      // "PERFECT" gets pink/gradient text, others get white
      if (fx.label === "PERFECT") {
        const grad = ctx.createLinearGradient(-60, 0, 60, 0);
        grad.addColorStop(0, "#ff69b4");
        grad.addColorStop(0.5, "#ffb6c1");
        grad.addColorStop(1, "#dda0dd");
        ctx.fillStyle = grad;
      } else if (isMiss) {
        ctx.fillStyle = "#ff4444";
      } else {
        ctx.fillStyle = "#ffffff";
      }

      ctx.shadowColor = "rgba(255,255,255,0.6)";
      ctx.shadowBlur = 12;
      ctx.font = "900 28px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fx.label, 0, 0);

      ctx.restore();

      // Combo "×N" to the right (MT3-accurate)
      if (!isMiss && state.combo > 1) {
        ctx.save();
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 16px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`×${state.combo}`, W / 2 + 55, H * 0.21 + yOff);
        ctx.restore();
      }
    }

    // ── Score popups "+2", "+4" at bottom of the lane (MT3-accurate) ──
    for (const p of state.scorePopups) {
      const age = now - p.timestamp;
      if (age > 500) continue;
      const t = age / 500;
      const alpha = t < 0.6 ? 1 : 1 - ((t - 0.6) / 0.4);
      const yOff = -15 * t;
      const x = laneW * p.lane + laneW / 2;
      const y = H * (HIT_ZONE_RATIO + 0.06) + yOff;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.font = "800 18px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`+${p.value}`, x, y);
      ctx.restore();
    }

    // ── Diamond particles ◆ ──
    const gravity = 200;
    this.particles = this.particles.filter((p) => {
      const age = (now - p.born) / 1000;
      if (age > p.life / 1000) return false;
      const t = age / (p.life / 1000);
      const px = p.x + p.vx * age;
      const py = p.y + p.vy * age + 0.5 * gravity * age * age;

      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = "#ffffff";
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
      return true;
    });

    // ── Golden confetti (MT3: floating diamonds during gold/late phases) ──
    if (progress > 0.4 && progress < 0.8) {
      if (now - this.lastConfettiSpawn > 200) {
        this.lastConfettiSpawn = now;
        this.confetti.push({
          x: Math.random() * W,
          y: -5,
          vx: (Math.random() - 0.5) * 40,
          vy: 30 + Math.random() * 50,
          size: 3 + Math.random() * 4,
          born: now,
          life: 3000 + Math.random() * 2000,
        });
      }
    }
    this.confetti = this.confetti.filter((c) => {
      const age = (now - c.born) / 1000;
      if (age > c.life / 1000) return false;
      const px = c.x + c.vx * age;
      const py = c.y + c.vy * age;
      const rot = age * 2;
      const alpha = Math.min(1, (c.life / 1000 - age) / 0.5);

      ctx.save();
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = "#ffc800";
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
      ctx.restore();
      return true;
    });

    // ── SPEED UP banner (MT3: golden chevron banner) ──
    if (this.speedUpBannerAlpha > 0.01) {
      const bannerAge = now - this.speedUpBannerTime;
      const bannerDuration = 1800;

      if (bannerAge < bannerDuration) {
        const t = bannerAge / bannerDuration;
        // Fade in fast, hold, fade out
        let alpha: number;
        if (t < 0.1) alpha = t / 0.1;
        else if (t < 0.7) alpha = 1;
        else alpha = 1 - ((t - 0.7) / 0.3);

        const bannerY = H * 0.38;
        const bannerH = 32;

        ctx.save();
        ctx.globalAlpha = alpha * 0.9;

        // Golden banner background
        const bannerGrad = ctx.createLinearGradient(0, bannerY, 0, bannerY + bannerH);
        bannerGrad.addColorStop(0, "#d4a843");
        bannerGrad.addColorStop(0.5, "#c49632");
        bannerGrad.addColorStop(1, "#b38728");
        ctx.fillStyle = bannerGrad;
        ctx.fillRect(0, bannerY, W, bannerH);

        // Chevron arrows (>> SPEED UP >>)
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        const chevronW = 12;
        for (let cx = 20; cx < W; cx += 35) {
          ctx.beginPath();
          ctx.moveTo(cx, bannerY + 6);
          ctx.lineTo(cx + chevronW, bannerY + bannerH / 2);
          ctx.lineTo(cx, bannerY + bannerH - 6);
          ctx.fill();
        }

        // "SPEED UP" text
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 16px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 4;
        ctx.fillText("SPEED UP", W / 2, bannerY + bannerH / 2);

        ctx.restore();
      } else {
        this.speedUpBannerAlpha = 0;
      }
    }

    // ── Miss red flash ──
    if (this.missFlashAlpha > 0.005) {
      ctx.fillStyle = `rgba(255,0,0,${this.missFlashAlpha})`;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      this.missFlashAlpha *= 0.90;
    }

    ctx.restore();
  }

  // ─── Geometric diamond overlay (MT3's chevron pattern) ───
  private paintDiamondOverlay(W: number, H: number, progress: number): void {
    const { ctx } = this;
    ctx.save();

    // Large overlapping diamond shapes at low opacity
    const cx = W * 0.5;
    const cy = H * 0.45;
    const maxR = Math.max(W, H) * 0.55;
    const rot = progress * Math.PI * 0.3;

    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    for (let i = 1; i <= 5; i++) {
      const s = maxR * i * 0.22;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.8, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.8, 0);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    // Secondary cluster (offset)
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.translate(W * 0.75, H * 0.25);
    ctx.rotate(-rot * 0.6);
    for (let i = 1; i <= 3; i++) {
      const s = maxR * i * 0.18;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.8, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.8, 0);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    // Third cluster (lower left)
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.translate(W * 0.2, H * 0.75);
    ctx.rotate(rot * 0.4);
    for (let i = 1; i <= 3; i++) {
      const s = maxR * i * 0.15;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.8, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.8, 0);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  // ─── Tile rendering ───
  private paintTile(
    t: GameTile, lane: number, laneW: number,
    gap: number, H: number, tileH: number,
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

    // Pure black, sharp corners, no border (MT3-accurate)
    ctx.fillStyle = TILE_BLACK;
    ctx.fillRect(x, y, w, tileH);
  }

  // ── Hold tile: dark navy body, white centerline, cyan cap when active ──
  private paintHoldTile(x: number, y: number, w: number, h: number, active: boolean): void {
    const { ctx } = this;

    // Head tile: black (at bottom of the hold, where the player first taps)
    const headH = Math.min(h * 0.12, 28);
    ctx.fillStyle = TILE_BLACK;
    ctx.fillRect(x, y + h - headH, w, headH);

    // Body: dark navy/teal gradient (MT3-accurate)
    const bodyH = h - headH;
    const bodyGrad = ctx.createLinearGradient(x, y, x + w, y);
    bodyGrad.addColorStop(0, active ? "#001a33" : "#001122");
    bodyGrad.addColorStop(0.5, active ? "#002244" : "#001a2e");
    bodyGrad.addColorStop(1, active ? "#001a33" : "#001122");
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x, y, w, bodyH);

    // White centerline (thin vertical line through body)
    const cx = x + w / 2;
    ctx.strokeStyle = active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y + bodyH);
    ctx.stroke();

    // Release indicator: circle at bottom of body (above head)
    const circleY = y + bodyH - 10;
    ctx.beginPath();
    ctx.arc(cx, circleY, 6, 0, Math.PI * 2);
    ctx.strokeStyle = active ? "#ffffff" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Active: bright cyan rounded cap at bottom (the glowing hold indicator)
    if (active) {
      const capH = Math.min(bodyH * 0.35, 80);
      const capY = y + bodyH - capH;

      // Cyan gradient fill
      const capGrad = ctx.createLinearGradient(0, capY, 0, capY + capH);
      capGrad.addColorStop(0, "rgba(0,230,255,0.3)");
      capGrad.addColorStop(0.5, "rgba(0,255,255,0.8)");
      capGrad.addColorStop(1, "rgba(0,255,255,0.95)");
      ctx.fillStyle = capGrad;

      // Rounded bottom cap shape
      const r = Math.min(w / 2, capH * 0.5);
      ctx.beginPath();
      ctx.moveTo(x, capY);
      ctx.lineTo(x + w, capY);
      ctx.lineTo(x + w, capY + capH - r);
      ctx.quadraticCurveTo(x + w, capY + capH, x + w - r, capY + capH);
      ctx.lineTo(x + r, capY + capH);
      ctx.quadraticCurveTo(x, capY + capH, x, capY + capH - r);
      ctx.closePath();
      ctx.fill();

      // Glow
      ctx.save();
      ctx.shadowColor = "#00ffff";
      ctx.shadowBlur = 16;
      ctx.strokeStyle = "rgba(0,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
}