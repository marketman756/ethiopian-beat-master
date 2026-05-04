import { supabase } from "@/integrations/supabase/client";

/**
 * Phase 5 — Telemetry & Resilience.
 * Best-effort, fire-and-forget. Never throws — analytics must never break the app.
 */

let installed = false;

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch { return null; }
}

export async function logError(
  message: string,
  stack?: string,
  context?: Record<string, unknown>,
) {
  try {
    const user_id = await currentUserId();
    await supabase.from("client_errors").insert({
      user_id: user_id ?? undefined,
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 8000),
      url: typeof window !== "undefined" ? window.location.href : undefined,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      context: (context ?? undefined) as never,
    });
  } catch {
    /* swallow */
  }
}

export type GameplayEvent =
  | "song_start"
  | "song_finish"
  | "song_fail"
  | "song_revive"
  | "song_quit"
  | "multiplayer_join"
  | "multiplayer_create";

export async function logEvent(
  event_type: GameplayEvent,
  song_id?: string | null,
  payload?: Record<string, unknown>,
) {
  try {
    const user_id = await currentUserId();
    await supabase.from("gameplay_events").insert({
      user_id: user_id ?? undefined,
      event_type,
      song_id: song_id ?? undefined,
      payload: (payload ?? undefined) as never,
    });
  } catch {
    /* swallow */
  }
}

/** Install global error/promise handlers exactly once. */
export function installTelemetry() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    logError(e.message ?? "window.error", e.error?.stack, {
      filename: e.filename, lineno: e.lineno, colno: e.colno,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason: any = e.reason;
    const msg = typeof reason === "string" ? reason : reason?.message ?? "unhandledrejection";
    logError(msg, reason?.stack, { kind: "unhandledrejection" });
  });
}