import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Trophy, Star } from "lucide-react";
import { songs } from "@/lib/songs";
import { fetchLeaderboard, LeaderboardRow } from "@/lib/scores";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

const medalColors = ["text-amber-500", "text-gray-400", "text-amber-700"];

const Leaderboard = () => {
  const { user } = useAuth();
  const [songId, setSongId] = useState(songs[0].id);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard(songId, 100).then((data) => {
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [songId]);

  const selectedSong = songs.find((s) => s.id === songId);
  const myRank = user ? rows.findIndex((r) => r.user_id === user.id) + 1 : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Leaderboard</h1>
        </div>

        <div className="mx-auto max-w-2xl mb-6">
          <Select value={songId} onValueChange={setSongId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {songs.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title} — {s.artist}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedSong && (
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedSong.genre} · {selectedSong.bpm} BPM · {selectedSong.duration}
            </p>
          )}
          {user && myRank > 0 && (
            <p className="mt-2 text-xs text-primary">Your rank: #{myRank}</p>
          )}
        </div>

        <div className="mx-auto max-w-2xl overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="grid grid-cols-[3rem_1fr_auto_auto_auto] gap-4 border-b px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Stars</span>
            <span className="text-right">Accuracy</span>
            <span className="text-right">Score</span>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No scores yet for this song. Be the first!
            </div>
          ) : (
            rows.map((p, i) => {
              const rank = i + 1;
              const isMe = user?.id === p.user_id;
              return (
                <div
                  key={p.user_id}
                  className={`grid grid-cols-[3rem_1fr_auto_auto_auto] gap-4 items-center border-b last:border-0 px-5 py-4 transition-colors ${isMe ? "bg-primary/10" : "hover:bg-muted/50"}`}
                >
                  <span className={`font-bold ${rank <= 3 ? medalColors[rank - 1] : "text-muted-foreground"}`}>
                    {rank}
                  </span>
                  <span className="font-medium truncate">
                    {p.display_name}
                    {p.is_guest && <span className="ml-2 text-xs text-muted-foreground">guest</span>}
                    {isMe && <span className="ml-2 text-xs text-primary">you</span>}
                  </span>
                  <span className="text-right text-sm flex items-center justify-end gap-0.5">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <Star key={idx} className={`h-3.5 w-3.5 ${idx < p.best_stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </span>
                  <span className="text-right text-sm text-muted-foreground tabular-nums">
                    {Number(p.best_accuracy).toFixed(1)}%
                  </span>
                  <span className="text-right font-semibold tabular-nums">
                    {p.best_score.toLocaleString()}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Leaderboard;