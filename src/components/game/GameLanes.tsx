import { memo, useCallback } from "react";
import { LANES, GameTile } from "@/lib/gameEngine";

interface GameLanesProps {
  tiles: GameTile[];
  onLaneTap: (lane: number) => void;
  onLaneRelease: (lane: number) => void;
}

const GameLanes = memo(({ tiles, onLaneTap, onLaneRelease }: GameLanesProps) => {
  const handlePointerDown = useCallback((lane: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    onLaneTap(lane);
  }, [onLaneTap]);

  const handlePointerUp = useCallback((lane: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    onLaneRelease(lane);
  }, [onLaneRelease]);

  return (
    <>
      {/* Lane dividers — thin subtle lines */}
      <div className="absolute inset-0 flex pointer-events-none">
        {Array.from({ length: LANES }).map((_, i) => (
          <div key={i} className="flex-1 border-r border-white/[0.08] last:border-r-0" />
        ))}
      </div>

      {/* Hit zone — glowing line */}
      <div
        className="absolute left-0 right-0 pointer-events-none z-[1]"
        style={{ top: "82%" }}
      >
        <div className="h-[2px] bg-white/25 shadow-[0_0_16px_3px_rgba(255,255,255,0.2)]" />
      </div>

      {/* Tiles */}
      {tiles.map((tile) => {
        if (tile.hit && tile.type !== "hold") return null;
        if (tile.type === "hold" && tile.holdComplete) return null;
        return <TileElement key={tile.id} tile={tile} />;
      })}

      {/* Double tile second lane */}
      {tiles.map((tile) => {
        if (tile.type !== "double" || tile.hit2 || tile.lane2 === undefined) return null;
        return <TileElement key={`d-${tile.id}`} tile={{ ...tile, lane: tile.lane2! }} isSecondLane />;
      })}

      {/* Touch zones */}
      <div className="absolute bottom-0 left-0 right-0 flex h-[50%] z-10">
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
}

const TileElement = memo(({ tile }: TileElementProps) => {
  const laneWidth = 100 / LANES;
  const gap = 0.4;
  const left = tile.lane * laneWidth + gap / 2;
  const width = laneWidth - gap;

  // HOLD TILE — cyan gradient with rounded bottom
  if (tile.type === "hold") {
    const isActive = tile.holding;
    return (
      <div
        className="absolute will-change-transform"
        style={{
          left: `${left}%`,
          width: `${width}%`,
          top: `${tile.y}%`,
          height: `${tile.holdHeight}%`,
          transform: "translateZ(0)",
        }}
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
        <div className="absolute inset-x-0 bottom-[38%] flex items-center justify-center">
          <span className="text-white font-black text-base drop-shadow-lg" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>+2</span>
        </div>
        <div className="absolute inset-x-0 bottom-[8%] flex items-center justify-center">
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

  // TAP TILE — solid black rectangle, fills the lane completely
  // Height is calculated to touch the next tile (continuous look)
  const tileHeight = 18;

  return (
    <div
      className="absolute will-change-transform"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: `${tile.y}%`,
        height: `${tileHeight}%`,
        transform: "translateZ(0)",
      }}
    >
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 50%, #000000 100%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
          borderRadius: "2px",
        }}
      >
        {/* Top edge highlight */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-b from-white/[0.08] to-transparent" />
        {/* Left edge reflection */}
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-r from-white/[0.04] to-transparent" />
      </div>
    </div>
  );
});

TileElement.displayName = "TileElement";

export default GameLanes;
