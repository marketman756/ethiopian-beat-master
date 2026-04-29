import { supabase } from "@/integrations/supabase/client";

export interface SubmitScoreInput {
  songId: string;
  score: number;
  maxCombo: number;
  perfects: number;
  greats: number;
  cools: number;
  misses: number;
  totalNotes: number;
  durationMs: number;
  stars: number;
}

/**
 * Submit a score via the SECURITY DEFINER `submit_score` RPC.
 * Server-side validation rejects impossible scores; do not bypass.
 */
export async function submitScore(input: SubmitScoreInput): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("submit_score", {
    p_song_id: input.songId,
    p_score: input.score,
    p_max_combo: input.maxCombo,
    p_perfects: input.perfects,
    p_greats: input.greats,
    p_cools: input.cools,
    p_misses: input.misses,
    p_total_notes: input.totalNotes,
    p_duration_ms: input.durationMs,
    p_stars: input.stars,
  });
  return { error: error ? new Error(error.message) : null };
}

export interface LeaderboardRow {
  user_id: string;
  best_score: number;
  best_accuracy: number;
  best_stars: number;
  best_max_combo: number;
  display_name: string;
  is_guest: boolean;
}

export async function fetchLeaderboard(songId: string, limit = 100): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("user_song_bests")
    .select("user_id, best_score, best_accuracy, best_stars, best_max_combo, profiles!inner(display_name, is_guest)")
    .eq("song_id", songId)
    .order("best_score", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row: any) => ({
    user_id: row.user_id,
    best_score: row.best_score,
    best_accuracy: row.best_accuracy,
    best_stars: row.best_stars,
    best_max_combo: row.best_max_combo,
    display_name: row.profiles?.display_name ?? "Player",
    is_guest: row.profiles?.is_guest ?? false,
  }));
}