import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MatchParticipant, MatchRoom, fetchParticipants } from "@/lib/multiplayer";

/**
 * Subscribe to a match room and its participants over Supabase Realtime.
 * Returns the latest room + participant list (sorted by score desc).
 */
export function useMatchRoom(roomId: string | null) {
  const [room, setRoom] = useState<MatchRoom | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    const { data: r } = await supabase.from("match_rooms").select().eq("id", roomId).maybeSingle();
    if (r) setRoom(r as MatchRoom);
    setParticipants(await fetchParticipants(roomId));
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    refresh();
    const channel = supabase
      .channel(`match-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_rooms", filter: `id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === "DELETE") setRoom(null);
        else setRoom(payload.new as MatchRoom);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_participants", filter: `room_id=eq.${roomId}` }, () => {
        // Re-fetch to get a sorted list — payload-only updates would require manual sort.
        fetchParticipants(roomId).then(setParticipants);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, refresh]);

  return { room, participants, refresh };
}