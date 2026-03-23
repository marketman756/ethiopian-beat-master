/**
 * Tile Chart System — continuous, BPM-synced tile patterns per song.
 * Every beat produces a tile. Faster BPM = denser tiles = faster feel.
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
}

/**
 * Generate a continuous, melodic tile chart synced to BPM.
 * NO random skipping — every subdivision gets a tile for a flowing piano feel.
 */
function generateContinuousChart(bpm: number, durationSec: number): ChartNote[] {
  const beatMs = 60000 / bpm;
  // Use eighth-note subdivisions for fast songs, quarter for slow
  const subdivision = bpm >= 110 ? 1 : 1; // always quarter notes for now
  const noteInterval = beatMs / subdivision;
  const totalNotes = Math.floor((durationSec * 1000) / noteInterval);
  const notes: ChartNote[] = [];

  // Melodic lane sequences — designed to feel like piano fingering
  const phrases = [
    // Stepwise ascending
    [0, 1, 2, 3],
    // Stepwise descending
    [3, 2, 1, 0],
    // Inner bounce
    [1, 2, 1, 2],
    // Wide zigzag
    [0, 3, 1, 2],
    // Trill left
    [0, 1, 0, 1],
    // Trill right
    [2, 3, 2, 3],
    // Sweep up and back
    [0, 1, 2, 3, 2, 1],
    // Jump pattern
    [0, 2, 3, 1],
    // Cascade
    [3, 1, 2, 0],
    // Neighbor motion
    [1, 0, 1, 2, 3, 2],
  ];

  let phraseIdx = 0;
  let noteInPhrase = 0;
  let currentPhrase = phrases[0];

  // Seed a simple deterministic random from BPM so charts are consistent
  let seed = bpm * 7 + 13;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 1000;
  };

  for (let i = 0; i < totalNotes; i++) {
    const time = Math.round(i * noteInterval);

    // Switch phrase every 8 notes
    if (i > 0 && i % 8 === 0) {
      phraseIdx = Math.floor(rand() * phrases.length);
      currentPhrase = phrases[phraseIdx];
      noteInPhrase = 0;
    }

    const lane = currentPhrase[noteInPhrase % currentPhrase.length];
    noteInPhrase++;

    // Decide tile type — deterministic based on position
    const r = rand();
    const sectionProgress = i / totalNotes;

    if (r < 0.06 && i > 12 && sectionProgress > 0.15) {
      // Double tile — simultaneous two-lane hit
      const lane2 = (lane + 2) % 4;
      notes.push({ time, lane, type: "double", lane2 });
    } else if (r < 0.14 && i > 6 && sectionProgress > 0.1) {
      // Hold tile — duration scales with BPM
      const holdBeats = 1.5 + rand() * 1.5;
      const holdDuration = Math.round(beatMs * holdBeats);
      notes.push({ time, lane, type: "hold", holdDuration });
      // Skip next note to avoid overlap with hold
      if (i + 1 < totalNotes) {
        i++;
        noteInPhrase++;
      }
    } else {
      notes.push({ time, lane, type: "tap" });
    }
  }

  return notes;
}

// Build chart from song data
function buildChart(songId: string, bpm: number, durationStr: string): TileChart {
  const [min, sec] = durationStr.split(":").map(Number);
  const durationSec = min * 60 + sec;
  return {
    songId,
    bpm,
    notes: generateContinuousChart(bpm, durationSec),
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
