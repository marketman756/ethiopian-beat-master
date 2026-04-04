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
      {/* MT3 style: very subtle lane dividers */}
      <div className="absolute inset-0 flex pointer-events-none">
        {Array.from({ length: LANES }).map((_, i) => (
          <div
            key={i}
            className="flex-1"
            style={{ borderRight: i < LANES - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}
          />
        ))}
      </div>

      {/* MT3: subtle hit zone line at bottom */}
      <div
        className="absolute left-0 right-0 pointer-events-none z-[1]"
        style={{ top: "82%" }}
      >
        <div style={{ height: "1px", background: "rgba(255,255,255,0.15)" }} />
      </div>

      {/* Tiles */}
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

      {/* Full-screen lane touch zones */}
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
  const gap = 0.5;
  const left = tile.lane * laneWidth + gap / 2;
  const width = laneWidth - gap;

  // ─── HOLD TILE (MT3: colored bar with circle at end) ───
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
        {/* Hold body - colored bar */}
        <div
          className="absolute inset-0 rounded-b-lg"
          style={{
            background: isActive
              ? "linear-gradient(180deg, #22d3ee 0%, #06b6d4 100%)"
              : "linear-gradient(180deg, #0891b2 0%, #0e7490 100%)",
            boxShadow: isActive ? "0 0 20px rgba(34,211,238,0.4)" : "none",
          }}
        />
        {/* Circle at end (release point) */}
        <div className="absolute inset-x-0 bottom-[6%] flex items-center justify-center pointer-events-none">
          <div
            className="w-5 h-5 rounded-full border-2"
            style={{
              borderColor: isActive ? "white" : "rgba(255,255,255,0.6)",
              backgroundColor: isActive ? "rgba(255,255,255,0.3)" : "transparent",
            }}
          />
        </div>
      </div>
    );
  }

  // ─── TAP TILE (MT3: pure black rectangle, clean and simple) ───
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
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "#000000",
          borderRadius: "4px",
        }}
      />
    </div>
  );
});

TileElement.displayName = "TileElement";

export default GameLanes;
