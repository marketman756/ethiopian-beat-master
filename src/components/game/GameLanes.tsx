import { LANES, GameTile } from "@/lib/gameEngine";

interface GameLanesProps {
  tiles: GameTile[];
  onLaneTap: (lane: number) => void;
  onLaneRelease: (lane: number) => void;
}

const GameLanes = ({ tiles, onLaneTap, onLaneRelease }: GameLanesProps) => {
  return (
    <>
      {/* Lane dividers — razor-thin white lines */}
      <div className="absolute inset-0 flex pointer-events-none">
        {Array.from({ length: LANES }).map((_, i) => (
          <div key={i} className="flex-1 border-r border-white/[0.08] last:border-r-0" />
        ))}
      </div>

      {/* Hit zone indicator — very subtle horizontal line */}
      <div
        className="absolute left-0 right-0 pointer-events-none z-[1]"
        style={{ top: "82%" }}
      >
        <div className="h-[1px] bg-white/[0.06]" />
      </div>

      {/* Render all visible tiles */}
      {tiles.filter((t) => !t.hit || (t.type === "hold" && t.holding)).map((tile) => (
        <TileElement key={tile.id} tile={tile} />
      ))}

      {/* Double tile second lane */}
      {tiles
        .filter((t) => t.type === "double" && !t.hit2 && t.lane2 !== undefined)
        .map((tile) => (
          <TileElement key={`d-${tile.id}`} tile={{ ...tile, lane: tile.lane2! }} isSecondLane />
        ))}

      {/* Tap zones — invisible touch targets across bottom */}
      <div className="absolute bottom-0 left-0 right-0 flex h-[45%] z-10">
        {Array.from({ length: LANES }).map((_, i) => (
          <button
            key={i}
            className="flex-1 active:bg-white/[0.04] transition-colors duration-75"
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
  const gapPx = 0.8;
  const left = tile.lane * laneWidth + gapPx / 2;
  const width = laneWidth - gapPx;

  // HOLD TILE — cyan/turquoise tall bar with rounded bottom
  if (tile.type === "hold") {
    return (
      <div
        className="absolute will-change-transform"
        style={{
          left: `${left}%`,
          width: `${width}%`,
          top: `${tile.y}%`,
          height: `${tile.holdHeight}%`,
        }}
      >
        {/* Body */}
        <div
          className={`absolute inset-0 rounded-b-[16px] ${
            tile.holding
              ? "bg-gradient-to-b from-cyan-300 via-cyan-400 to-cyan-500 shadow-[0_0_24px_rgba(34,211,238,0.6)]"
              : "bg-gradient-to-b from-cyan-400 via-cyan-500 to-cyan-600"
          }`}
        >
          {/* Inner shine */}
          <div className="absolute inset-x-[15%] top-0 h-full bg-gradient-to-b from-white/20 to-transparent rounded-b-[16px]" />
        </div>
        {/* +2 label */}
        <div className="absolute inset-x-0 bottom-[35%] flex items-center justify-center">
          <span className="text-white font-black text-sm drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)]">+2</span>
        </div>
        {/* Release circle */}
        <div className="absolute inset-x-0 bottom-[10%] flex items-center justify-center">
          <div className={`w-5 h-5 rounded-full border-[2.5px] ${
            tile.holding ? "border-white bg-white/20" : "border-white/60 bg-transparent"
          }`} />
        </div>
      </div>
    );
  }

  // TAP TILE — solid black, tall, sharp edges like piano keys
  // Height is generous to create the continuous flowing look
  const tileHeight = 14;

  return (
    <div
      className="absolute will-change-transform"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: `${tile.y}%`,
        height: `${tileHeight}%`,
      }}
    >
      {/* Main black tile body */}
      <div className="absolute inset-0 bg-gray-950 rounded-[2px]">
        {/* Subtle top highlight for depth */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-b from-white/[0.08] to-transparent rounded-t-[2px]" />
        {/* Left edge highlight */}
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-r from-white/[0.06] to-transparent" />
      </div>
    </div>
  );
};

export default GameLanes;
