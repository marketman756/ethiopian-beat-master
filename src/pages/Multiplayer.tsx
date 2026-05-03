import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { songs } from "@/lib/songs";
import { createRoom, joinRoom } from "@/lib/multiplayer";
import { Users, Trophy, Plus, LogIn } from "lucide-react";
import { toast } from "sonner";

const Multiplayer = () => {
  const navigate = useNavigate();
  const { user, profile, signInAsGuest } = useAuth();
  const [songId, setSongId] = useState(songs[0].id);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const ensureAuth = async (): Promise<string | null> => {
    if (user && profile) return profile.display_name;
    const name = "Guest" + Math.floor(Math.random() * 9999);
    const { error } = await signInAsGuest(name);
    if (error) {
      toast.error("Could not create guest session");
      return null;
    }
    return name;
  };

  const handleCreate = async () => {
    setBusy(true);
    try {
      const name = await ensureAuth();
      if (!name) return;
      const { room, error } = await createRoom(songId, profile?.display_name ?? name);
      if (error || !room) {
        toast.error("Failed to create room: " + (error ?? "unknown"));
        return;
      }
      navigate(`/multiplayer/${room.code}`);
    } finally { setBusy(false); }
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const name = await ensureAuth();
      if (!name) return;
      const { room, error } = await joinRoom(code.trim(), profile?.display_name ?? name);
      if (error || !room) {
        toast.error(error === "room_not_found" ? "Room not found" : "Failed to join room");
        return;
      }
      navigate(`/multiplayer/${room.code}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10">
        <div className="flex items-center gap-3 mb-8">
          <Users className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Multiplayer Race</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Host a race</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Pick a song, share the room code, race for the highest score.
            </p>
            <Select value={songId} onValueChange={setSongId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {songs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.title} — {s.artist}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full" disabled={busy} onClick={handleCreate}>
              <Trophy className="mr-2 h-4 w-4" /> Create Room
            </Button>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Join a race</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Got a 5-letter code? Drop it here to jump in.
            </p>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCDE"
              maxLength={5}
              className="text-center text-2xl tracking-[0.5em] uppercase font-mono"
            />
            <Button className="w-full" variant="secondary" disabled={busy || code.length < 5} onClick={handleJoin}>
              Join Room
            </Button>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Multiplayer;