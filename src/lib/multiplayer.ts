import { supabase } from "@/integrations/supabase/client";

export interface MatchRoom {
  id: string;
  code: string;
  host_id: string;
  song_id: string | null;
  status: "lobby" | "playing" | "finished";
  started_at: string | null;
}

export interface MatchParticipant {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  score: number;
  combo: number;
  max_combo: number;
  accuracy: number;
  finished: boolean;
}

function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function createRoom(songId: string, displayName: string): Promise<{ room?: MatchRoom; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { error: "not_authenticated" };

  // Try a few codes in case of collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const { data, error } = await supabase
      .from("match_rooms")
      .insert({ code, host_id: uid, song_id: songId, status: "lobby" })
      .select()
      .single();
    if (!error && data) {
      await supabase.from("match_participants").insert({
        room_id: data.id, user_id: uid, display_name: displayName,
      });
      return { room: data as MatchRoom };
    }
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      return { error: error.message };
    }
  }
  return { error: "could_not_allocate_code" };
}

export async function joinRoom(code: string, displayName: string): Promise<{ room?: MatchRoom; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { error: "not_authenticated" };

  const { data: room, error } = await supabase
    .from("match_rooms")
    .select()
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error || !room) return { error: "room_not_found" };
  if (room.status === "finished") return { error: "room_finished" };

  await supabase
    .from("match_participants")
    .upsert(
      { room_id: room.id, user_id: uid, display_name: displayName, finished: false, score: 0, combo: 0, max_combo: 0, accuracy: 0 },
      { onConflict: "room_id,user_id" },
    );
  return { room: room as MatchRoom };
}

export async function leaveRoom(roomId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  await supabase.from("match_participants").delete().eq("room_id", roomId).eq("user_id", uid);
}

export async function startRoom(roomId: string) {
  await supabase
    .from("match_rooms")
    .update({ status: "playing", started_at: new Date().toISOString() })
    .eq("id", roomId);
}

export async function finishRoom(roomId: string) {
  await supabase.from("match_rooms").update({ status: "finished" }).eq("id", roomId);
}

export async function updateMyProgress(roomId: string, patch: Partial<Pick<MatchParticipant, "score" | "combo" | "max_combo" | "accuracy" | "finished">>) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  await supabase.from("match_participants").update(patch).eq("room_id", roomId).eq("user_id", uid);
}

export async function fetchRoomByCode(code: string): Promise<MatchRoom | null> {
  const { data } = await supabase.from("match_rooms").select().eq("code", code.toUpperCase()).maybeSingle();
  return (data as MatchRoom) ?? null;
}

export async function fetchParticipants(roomId: string): Promise<MatchParticipant[]> {
  const { data } = await supabase.from("match_participants").select().eq("room_id", roomId).order("score", { ascending: false });
  return (data as MatchParticipant[]) ?? [];
}

/**
 * Trigger server-side cleanup of stale rooms (>30min idle).
 * Safe to call opportunistically — server enforces auth and is idempotent.
 */
export async function cleanupStaleRooms(): Promise<number> {
  const { data, error } = await (supabase as any).rpc("cleanup_stale_match_rooms");
  if (error || typeof data !== "number") return 0;
  return data;
}