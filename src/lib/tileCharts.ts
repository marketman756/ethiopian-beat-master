/**
 * Tile Chart System — predefined tile patterns per song
 * Each chart entry defines: time (ms), lane (0-3), type, and optional duration for holds.
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
  notes: ChartNote[];
}

// Helper to generate a melodic pattern
function generateMelodicPattern(bpm: number, durationSec: number): ChartNote[] {
  const beatMs = 60000 / bpm;
  const notes: ChartNote[] = [];
  const totalBeats = Math.floor((durationSec * 1000) / beatMs);

  // Predefined lane sequences that feel like piano patterns
  const patterns = [
    // Ascending
    [0, 1, 2, 3],
    // Descending
    [3, 2, 1, 0],
    // Zigzag
    [0, 2, 1, 3],
    // Bounce
    [1, 3, 0, 2],
    // Trills
    [0, 1, 0, 1],
    [2, 3, 2, 3],
    // Sweep
    [0, 1, 2, 3, 3, 2, 1, 0],
    // Jump
    [0, 3, 1, 2],
  ];

  let patternIdx = 0;
  let noteInPattern = 0;
  let currentPattern = patterns[0];

  for (let beat = 0; beat < totalBeats; beat++) {
    const time = Math.round(beat * beatMs);

    // Every 8 beats, possibly switch pattern
    if (beat % 8 === 0 && beat > 0) {
      patternIdx = (patternIdx + 1) % patterns.length;
      currentPattern = patterns[patternIdx];
      noteInPattern = 0;
    }

    // Not every beat has a note — create rhythm variation
    const density = beat < 8 ? 0.5 : beat < 24 ? 0.7 : 0.85;
    if (Math.random() > density) continue;

    const lane = currentPattern[noteInPattern % currentPattern.length];
    noteInPattern++;

    // Decide tile type
    const roll = Math.random();
    if (roll < 0.08 && beat > 8) {
      // Double tile (two lanes at once)
      const lane2 = (lane + 2) % 4;
      notes.push({ time, lane, type: "double", lane2 });
    } else if (roll < 0.18 && beat > 4) {
      // Hold tile
      const holdDuration = Math.round(beatMs * (1 + Math.random()));
      notes.push({ time, lane, type: "hold", holdDuration });
    } else {
      notes.push({ time, lane, type: "tap" });
    }
  }

  return notes;
}

// Generate charts for all songs
function buildChart(songId: string, bpm: number, durationStr: string): TileChart {
  const [min, sec] = durationStr.split(":").map(Number);
  const durationSec = min * 60 + sec;
  return {
    songId,
    notes: generateMelodicPattern(bpm, durationSec),
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
];

export function getChartForSong(songId: string): TileChart | undefined {
  return tileCharts.find((c) => c.songId === songId);
}
