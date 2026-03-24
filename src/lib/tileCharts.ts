/**
 * Tile Chart System — CONTINUOUS back-to-back tiles synced to BPM.
 * Every tile ends exactly where the next one begins on a DIFFERENT lane.
 * This creates the signature Magic Tiles 3 "piano roll" feel.
 */

export type TileType = "tap" | "hold" | "double";

export interface ChartNote {
  time: number;       // ms from song start
  lane: number;       // 0-3
  type: TileType;
  holdDuration?: number; // ms, for hold tiles
  lane2?: number;     // second lane for double tiles
}

export interface TileChart {
  songId: string;
  bpm: number;
  notes: ChartNote[];
  audioUrl?: string;  // path to audio file
}

/**
 * Generate a TRULY CONTINUOUS chart where every tile flows into the next.
 * Key rule: each new tile MUST be on a DIFFERENT lane than the previous one.
 * Tiles are placed on every beat subdivision with zero gaps.
 */
function generateContinuousChart(bpm: number, durationSec: number, songSeed: number): ChartNote[] {
  const beatMs = 60000 / bpm;
  // Use quarter notes as base — each beat gets a tile
  const noteInterval = beatMs;
  const totalNotes = Math.floor((durationSec * 1000) / noteInterval);
  const notes: ChartNote[] = [];

  // Deterministic RNG from song seed
  let seed = songSeed;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 1000;
  };

  let prevLane = -1;

  for (let i = 0; i < totalNotes; i++) {
    const time = Math.round(i * noteInterval);

    // Pick lane — MUST be different from previous lane
    let lane: number;
    if (prevLane === -1) {
      lane = Math.floor(rand() * 4);
    } else {
      // Pick from the 3 remaining lanes
      const available = [0, 1, 2, 3].filter(l => l !== prevLane);
      lane = available[Math.floor(rand() * 3)];
    }

    const r = rand();
    const progress = i / totalNotes;

    if (r < 0.05 && i > 16 && progress > 0.2) {
      // Double tile — two lanes simultaneously
      const otherLanes = [0, 1, 2, 3].filter(l => l !== lane);
      const lane2 = otherLanes[Math.floor(rand() * otherLanes.length)];
      notes.push({ time, lane, type: "double", lane2 });
      prevLane = lane;
    } else if (r < 0.12 && i > 8 && progress > 0.1) {
      // Hold tile — spans multiple beats
      const holdBeats = 1.5 + rand() * 2;
      const holdDuration = Math.round(beatMs * holdBeats);
      notes.push({ time, lane, type: "hold", holdDuration });
      // Skip notes that overlap with hold duration
      const skipCount = Math.floor(holdDuration / noteInterval);
      i += skipCount;
      prevLane = lane;
    } else {
      // Standard tap tile
      notes.push({ time, lane, type: "tap" });
      prevLane = lane;
    }
  }

  return notes;
}

// Build chart from song data
function buildChart(songId: string, bpm: number, durationStr: string, audioUrl?: string): TileChart {
  const [min, sec] = durationStr.split(":").map(Number);
  const durationSec = min * 60 + sec;
  // Use songId as seed for deterministic but unique charts
  const seed = parseInt(songId) * 7919 + bpm * 13;
  return {
    songId,
    bpm,
    notes: generateContinuousChart(bpm, durationSec, seed),
    audioUrl,
  };
}

export const tileCharts: TileChart[] = [
  buildChart("1", 85, "4:32"),
  buildChart("2", 92, "5:10"),
  buildChart("3", 120, "3:45"),
  buildChart("4", 78, "4:15"),
  buildChart("5", 130, "4:50"),
  buildChart("6", 110, "6:20"),
  buildChart("7", 95, "5:45"),
  buildChart("8", 88, "4:00"),
  buildChart("9", 115, "3:55"),
  buildChart("10", 105, "5:30"),
  buildChart("11", 100, "4:40"),
  buildChart("12", 118, "3:30"),
  buildChart("13", 105, "5:00", "/audio/gud-yaregegn.mp3"),
];

export function getChartForSong(songId: string): TileChart | undefined {
  return tileCharts.find((c) => c.songId === songId);
}
