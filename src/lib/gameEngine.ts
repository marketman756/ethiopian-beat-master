/**
 * Game Engine — core types and constants for the rhythm game.
 */

export const LANES = 4;

// Speed multipliers per round
export const ROUND_SPEEDS = [1.0, 1.25, 1.5, 2.0];

export type GamePhase = "loading" | "ready" | "playing" | "paused" | "failed" | "round-complete" | "song-complete";

export interface GameTile {
  id: number;
  lane: number;
  type: "tap" | "hold" | "double";
  lane2?: number;        // for double tiles
  /** Position as percentage from top (0 = top, 100 = bottom) */
  y: number;
  /** For hold tiles — height percentage */
  holdHeight: number;
  /** Whether this tile has been hit */
  hit: boolean;
  /** For hold tiles — whether currently being held */
  holding: boolean;
  /** For hold tiles — whether hold was completed */
  holdComplete: boolean;
  /** For double tiles — whether second lane was hit */
  hit2: boolean;
  /** Chart time in ms */
  chartTime: number;
}

export interface HitEffect {
  id: number;
  lane: number;
  y: number;
  label: string;
  timestamp: number;
}

export const HIT_LABELS = ["PERFECT", "GREAT", "COOL", "NICE"] as const;

export function getHitLabel(accuracy: number): string {
  if (accuracy < 6) return "PERFECT";
  if (accuracy < 12) return "GREAT";
  if (accuracy < 20) return "COOL";
  return "NICE";
}

export function getScoreForHit(label: string, combo: number): number {
  const base = label === "PERFECT" ? 15 : label === "GREAT" ? 12 : label === "COOL" ? 8 : 5;
  return base + Math.floor(combo * 1.5);
}
