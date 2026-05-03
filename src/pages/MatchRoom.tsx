import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { fetchRoomByCode, joinRoom, leaveRoom, startRoom, MatchRoom as MatchRoomType } from "@/lib/multiplayer";
import { useMatchRoom } from "@/hooks/useMatchRoom";
import { songs } from "@/lib/songs";
import { Crown, Users, Play as PlayIcon, LogOut, Copy, Trophy } from "lucide-react";
import { toast } from "sonner";

const MatchRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [resolved, setResolved] = useState<MatchRoomType | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve the code to a room id once
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    fetchRoomByCode(code).then(async (room) => {
      if (cancelled) return;
      if (!room) {
        toast.error("Room not found");
        navigate("/multiplayer");
        return;
      }
      // Auto-join if signed in and not already a participant
      if (user && profile) {
        await joinRoom(code, profile.display_name);
      }
      setResolved(room);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [code, user, profile, navigate]);

  const { room, participants } = useMatchRoom(resolved?.id ?? null);
  const live = room ?? resolved;
  const isHost = user?.id === live?.host_id;
  const song = useMemo(() => songs.find((s) => s.id === live?.song_id) ?? null, [live]);

  // When host starts the match, navigate everyone into Play with ?room=
  useEffect(() => {
    if (live?.status === "playing" && live.song_id && live.id) {
      navigate(`/play/${live.song_id}?room=${live.id}`);
    }
  }, [live?.status, live?.song_id, live?.id, navigate]);

  const handleStart = async () => {
    if (!live) return;
    if (participants.length < 1) return;
    await startRoom(live.id);
  };

  const handleLeave = async () => {
    if (live) await leaveRoom(live.id);
    navigate("/multiplayer");
  };

  const copyCode = () => {
    if (!live) return;
    navigator.clipboard.writeText(live.code);
    toast.success("Room code copied");
  };

  if (loading || !live) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-10 text-center text-muted-foreground">Loading room…</main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Room code</p>
                <button
                  onClick={copyCode}
                  className="mt-1 flex items-center gap-2 text-4xl font-mono font-bold tracking-[0.4em] text-primary hover:opacity-80"
                >
                  {live.code} <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Song</p>
                <p className="font-semibold">{song?.title ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{song?.artist}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {live.status === "playing" || live.status === "finished" ? <Trophy className="h-5 w-5 text-primary" /> : <Users className="h-5 w-5 text-primary" />}
                <h2 className="text-xl font-semibold">
                  {live.status === "lobby" ? "Players" : live.status === "playing" ? "Live Race" : "Final Results"}
                </h2>
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{live.status}</span>
            </div>

            <div className="divide-y">
              {participants.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground text-center">No players yet…</p>
              )}
              {participants.map((p, i) => {
                const isMe = p.user_id === user?.id;
                const isRoomHost = p.user_id === live.host_id;
                return (
                  <div key={p.id} className={`grid grid-cols-[2rem_1fr_auto_auto] gap-4 items-center py-3 ${isMe ? "text-primary" : ""}`}>
                    <span className="font-bold text-sm text-muted-foreground">#{i + 1}</span>
                    <span className="font-medium flex items-center gap-2 truncate">
                      {isRoomHost && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                      {p.display_name}
                      {isMe && <span className="text-xs text-primary/70">(you)</span>}
                      {p.finished && <span className="text-xs text-emerald-500">✓ finished</span>}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">x{p.combo}</span>
                    <span className="font-bold tabular-nums text-lg">{p.score.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleLeave}>
              <LogOut className="mr-2 h-4 w-4" /> Leave
            </Button>
            {isHost && live.status === "lobby" && (
              <Button onClick={handleStart} disabled={!live.song_id || participants.length === 0}>
                <PlayIcon className="mr-2 h-4 w-4" /> Start Race
              </Button>
            )}
            {!isHost && live.status === "lobby" && (
              <p className="text-sm text-muted-foreground self-center">Waiting for host to start…</p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MatchRoom;