import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Trophy } from "lucide-react";

const mockLeaders = [
  { rank: 1, name: "Abeba M.", score: 24850, combo: 142 },
  { rank: 2, name: "Dawit K.", score: 22340, combo: 128 },
  { rank: 3, name: "Tigist A.", score: 19120, combo: 115 },
  { rank: 4, name: "Henok B.", score: 17890, combo: 98 },
  { rank: 5, name: "Sara T.", score: 16540, combo: 91 },
  { rank: 6, name: "Yonas G.", score: 15200, combo: 87 },
  { rank: 7, name: "Meron D.", score: 14100, combo: 82 },
  { rank: 8, name: "Kaleb F.", score: 12950, combo: 76 },
];

const medalColors = ["text-amber-500", "text-gray-400", "text-amber-700"];

const Leaderboard = () => (
  <div className="min-h-screen flex flex-col">
    <Navbar />
    <main className="flex-1 container py-10">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-bold">Leaderboard</h1>
      </div>

      <div className="mx-auto max-w-2xl overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="grid grid-cols-[3rem_1fr_auto_auto] gap-4 border-b px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Score</span>
          <span className="text-right">Best Combo</span>
        </div>
        {mockLeaders.map((player) => (
          <div
            key={player.rank}
            className="grid grid-cols-[3rem_1fr_auto_auto] gap-4 items-center border-b last:border-0 px-5 py-4 transition-colors hover:bg-muted/50"
          >
            <span className={`font-bold ${player.rank <= 3 ? medalColors[player.rank - 1] : "text-muted-foreground"}`}>
              {player.rank}
            </span>
            <span className="font-medium">{player.name}</span>
            <span className="text-right font-semibold tabular-nums">{player.score.toLocaleString()}</span>
            <span className="text-right text-sm text-muted-foreground tabular-nums">{player.combo}x</span>
          </div>
        ))}
      </div>
    </main>
    <Footer />
  </div>
);

export default Leaderboard;
