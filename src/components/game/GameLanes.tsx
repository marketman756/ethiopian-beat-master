import { LANES, GameTile } from "@/lib/gameEngine";

interface GameLanesProps {
  tiles: GameTile[];
  onLaneTap: (lane: number) => void;
  onLaneRelease: (lane: number) => void;
}

const GameLanes = ({ tiles, onLaneTap, onLaneRelease }: GameLanesProps) => {
  return (
    <>
      {/* Lane dividers — thin subtle white lines like MT3 */}
      <div className="absolute inset-0 flex pointer-events-none">
        {Array.from({ length: LANES }).map((_, i) => (
          <div key={i} className="flex-1 border-r border-white/[0.12] last:border-r-0" />
        ))}
      </div>

      {/* Tiles */}
      {tiles.filter((t) => !t.hit || (t.type === "hold" && t.holding)).map((tile) => (
        <TileElement key={tile.id} tile={tile} />
      ))}

      {/* Double tile second lane */}
      {tiles
        .filter((t) => t.type === "double" && !t.hit2 && t.lane2 !== undefined)
        .map((tile) => (
          <TileElement key={`d-${tile.id}`} tile={{ ...tile, lane: tile.lane2! }} isSecondLane />
        ))}

      {/* Tap zones — invisible, full bottom area */}
      <div className="absolute bottom-0 left-0 right-0 flex h-[40%] z-10">
        {Array.from({ length: LANES }).map((_, i) => (
          <button
            key={i}
            className="flex-1 active:bg-white/[0.06] transition-colors duration-75"
            onPointerDown={() => onLaneTap(i)}
            onPointerUp={() => onLaneRelease(i)}
            onPointerCancel={() => onLaneRelease(i)}
            onPointerLeave={() => onLaneRelease(i)}
          />
        ))}
      </div>
    </>
  );
};

interface TileElementProps {
  tile: GameTile;
  isSecondLane?: boolean;
}

const TileElement = ({ tile, isSecondLane }: TileElementProps) => {
  const laneWidth = 100 / LANES;
  const gapPx = 1.5; // gap in percentage
  const left = tile.lane * laneWidth + gapPx / 2;
  const width = laneWidth - gapPx;

  // HOLD TILE — cyan/turquoise with circle indicator and +2
  if (tile.type === "hold") {
    return (
      <div
        className="absolute transition-opacity duration-75"
        style={{
          left: `${left}%`,
          width: `${width}%`,
          top: `${tile.y}%`,
          height: `${tile.holdHeight}%`,
        }}
      >
        {/* Hold tile body */}
        <div
          className={`absolute inset-0 rounded-t-[4px] rounded-b-[20px] ${
            tile.holding
              ? "bg-gradient-to-b from-cyan-400 to-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.5)]"
              : "bg-gradient-to-b from-cyan-400 to-cyan-600"
          }`}
        />
        {/* Score indicator */}
        <div className="absolute inset-x-0 bottom-[30%] flex items-center justify-center">
          <span className="text-white/80 font-bold text-sm drop-shadow-md">+2</span>
        </div>
        {/* Circle indicator at bottom */}
        <div className="absolute inset-x-0 bottom-[8%] flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-white/70 bg-transparent" />
        </div>
      </div>
    );
  }

  // TAP TILE — solid black, sharp edges, like piano keys
  return (
    <div
      className="absolute bg-gray-950 rounded-[3px] shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: `${tile.y}%`,
        height: "12%",
      }}
    />
  );
};

export default GameLanes;
