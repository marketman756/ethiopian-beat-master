import { LANES, GameTile } from "@/lib/gameEngine";

interface GameLanesProps {
  tiles: GameTile[];
  onLaneTap: (lane: number) => void;
  onLaneRelease: (lane: number) => void;
}

const GameLanes = ({ tiles, onLaneTap, onLaneRelease }: GameLanesProps) => {
  return (
    <>
      {/* Lane dividers */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: LANES }).map((_, i) => (
          <div key={i} className="flex-1 border-r border-white/10 last:border-r-0" />
        ))}
      </div>

      {/* Bottom hit zone indicator */}
      <div className="absolute bottom-[12%] left-0 right-0 h-[2px] bg-white/20" />

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

      {/* Tap zones */}
      <div className="absolute bottom-0 left-0 right-0 flex h-[35%]">
        {Array.from({ length: LANES }).map((_, i) => (
          <button
            key={i}
            className="flex-1 active:bg-white/10 transition-colors duration-50"
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
  const left = tile.lane * laneWidth + 0.5;
  const width = laneWidth - 1;

  if (tile.type === "hold") {
    return (
      <div
        className={`absolute rounded-sm transition-opacity duration-75 ${
          tile.holding
            ? "bg-emerald-500 border border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
            : "bg-gray-900 border border-gray-700/40"
        }`}
        style={{
          left: `${left}%`,
          width: `${width}%`,
          top: `${tile.y}%`,
          height: `${tile.holdHeight}%`,
        }}
      >
        {/* Hold indicator stripe */}
        <div className="absolute inset-x-0 bottom-0 h-3 bg-white/10 rounded-b-sm" />
      </div>
    );
  }

  return (
    <div
      className="absolute rounded-sm bg-gray-900 border border-gray-700/40 shadow-lg"
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
