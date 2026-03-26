import { memo, useCallback } from "react";
import { LANES, GameTile } from "@/lib/gameEngine";

interface GameLanesProps {
  tiles: GameTile[];
  onLaneTap: (lane: number) => void;
  onLaneRelease: (lane: number) => void;
  bpm: number;
  fallDurationMs: number;
}

const HIT_ZONE_Y = 82;

const GameLanes = memo(({ tiles, onLaneTap, onLaneRelease, bpm, fallDurationMs }: GameLanesProps) => {
  const beatMs = 60000 / bpm;
  const tileHeight = (beatMs / fallDurationMs) * HIT_ZONE_Y + 2;

  const handlePointerDown = useCallback((lane: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onLaneTap(lane);
  }, [onLaneTap]);

  const handlePointerUp = useCallback((lane: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onLaneRelease(lane);
  }, [onLaneRelease]);

  return (
    <>
      {/* Lane dividers */}
      <div className="absolute inset-0 flex pointer-events-none">
        {Array.from({ length: LANES }).map((_, i) => (
          <div
            key={i}
            className="flex-1 last:border-r-0"
            style={{ borderRight: i < LANES - 1 ? "1px solid rgba(234,179,8,0.08)" : "none" }}
          />
        ))}
      </div>

      {/* Hit zone line */}
      <div
        className="absolute left-0 right-0 pointer-events-none z-[1]"
        style={{ top: "82%" }}
      >
        <div
          style={{
            height: "2px",
            background: "linear-gradient(90deg, rgba(234,179,8,0.1), rgba(234,179,8,0.4), rgba(234,179,8,0.1))",
            boxShadow: "0 0 12px 2px rgba(234,179,8,0.15)",
          }}
        />
      </div>

      {/* Tiles — rendered WITH pointer events so they are directly tappable */}
      {tiles.map((tile) => {
        if (tile.hit && tile.type !== "hold") return null;
        if (tile.type === "hold" && tile.holdComplete) return null;
        return (
          <TileElement
            key={tile.id}
            tile={tile}
            tileHeight={tileHeight}
            onPointerDown={handlePointerDown(tile.lane)}
            onPointerUp={handlePointerUp(tile.lane)}
          />
        );
      })}

      {/* Double tile second lane */}
      {tiles.map((tile) => {
        if (tile.type !== "double" || tile.hit2 || tile.lane2 === undefined) return null;
        return (
          <TileElement
            key={`d-${tile.id}`}
            tile={{ ...tile, lane: tile.lane2! }}
            isSecondLane
            tileHeight={tileHeight}
            onPointerDown={handlePointerDown(tile.lane2!)}
            onPointerUp={handlePointerUp(tile.lane2!)}
          />
        );
      })}

      {/* Full-screen lane touch zones as FALLBACK — covers entire height for taps that land between tiles */}
      <div className="absolute inset-0 flex z-[5]">
        {Array.from({ length: LANES }).map((_, i) => (
          <div
            key={i}
            className="flex-1 touch-none"
            onPointerDown={handlePointerDown(i)}
            onPointerUp={handlePointerUp(i)}
            onPointerCancel={handlePointerUp(i)}
            onPointerLeave={handlePointerUp(i)}
          />
        ))}
      </div>
    </>
  );
});

GameLanes.displayName = "GameLanes";

interface TileElementProps {
  tile: GameTile;
  isSecondLane?: boolean;
  tileHeight: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

const TileElement = memo(({ tile, tileHeight, onPointerDown, onPointerUp }: TileElementProps) => {
  const laneWidth = 100 / LANES;
  const gap = 0.3;
  const left = tile.lane * laneWidth + gap / 2;
  const width = laneWidth - gap;

  // ─── HOLD TILE ───
  if (tile.type === "hold") {
    const isActive = tile.holding;
    return (
      <div
        className="absolute will-change-transform z-[8] touch-none"
        style={{
          left: `${left}%`,
          width: `${width}%`,
          top: `${tile.y}%`,
          height: `${tile.holdHeight}%`,
          transform: "translateZ(0)",
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div
          className="absolute inset-0 rounded-b-2xl overflow-hidden"
          style={{
            background: isActive
              ? "linear-gradient(180deg, #22d3ee 0%, #06b6d4 40%, #0891b2 100%)"
              : "linear-gradient(180deg, #06b6d4 0%, #0891b2 40%, #0e7490 100%)",
            boxShadow: isActive
              ? "0 0 30px 8px rgba(34,211,238,0.5), inset 0 0 20px rgba(255,255,255,0.15)"
              : "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          <div className="absolute left-[20%] right-[50%] top-0 bottom-0 bg-gradient-to-r from-white/25 to-transparent" />
          {isActive && <div className="absolute inset-0 bg-white/10 animate-pulse" />}
        </div>
        <div className="absolute inset-x-0 bottom-[38%] flex items-center justify-center pointer-events-none">
          <span className="text-white font-black text-base drop-shadow-lg" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>+2</span>
        </div>
        <div className="absolute inset-x-0 bottom-[8%] flex items-center justify-center pointer-events-none">
          <div
            className="w-6 h-6 rounded-full border-[2.5px]"
            style={{
              borderColor: isActive ? "white" : "rgba(255,255,255,0.5)",
              backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "transparent",
              boxShadow: isActive ? "0 0 12px rgba(255,255,255,0.4)" : "none",
            }}
          />
        </div>
      </div>
    );
  }

  // ─── TAP TILE ───
  return (
    <div
      className="absolute will-change-transform z-[8] touch-none"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: `${tile.y}%`,
        height: `${tileHeight}%`,
        transform: "translateZ(0)",
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          background: "linear-gradient(180deg, #1c1c1c 0%, #111111 35%, #080808 70%, #000000 100%)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.5)",
          borderRadius: "3px",
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-[1.5px]"
          style={{ background: "linear-gradient(90deg, rgba(234,179,8,0.0), rgba(234,179,8,0.12), rgba(234,179,8,0.0))" }}
        />
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-r from-white/[0.06] to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-black/40" />
        <div className="absolute inset-x-[4px] top-[2px] bottom-[2px] rounded-[2px] bg-gradient-to-b from-white/[0.03] via-transparent to-black/20" />
      </div>
    </div>
  );
});

TileElement.displayName = "TileElement";

export default GameLanes;
