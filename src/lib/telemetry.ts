import { supabase } from "@/integrations/supabase/client";

/**
 * Phase 5 — Telemetry & Resilience.
 * Best-effort. Buffers + debounces inserts so a render-loop crash can't hammer
 * the database with one INSERT per frame.
 */

let installed = false;
const ERROR_BUFFER: any[] = [];
const EVENT_BUFFER: any[] = [];
const MAX_BUFFER = 50;
const FLUSH_INTERVAL_MS = 2000;
const DEDUPE_WINDOW_MS = 5000;
const recentErrorKeys = new Map<string, number>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch { return null; }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushNow();
  }, FLUSH_INTERVAL_MS);
}

async function flushNow() {
  if (ERROR_BUFFER.length === 0 && EVENT_BUFFER.length === 0) return;
  const errs = ERROR_BUFFER.splice(0, ERROR_BUFFER.length);
  const evts = EVENT_BUFFER.splice(0, EVENT_BUFFER.length);
  try {
    if (errs.length) await supabase.from("client_errors").insert(errs);
  } catch { /* swallow */ }
  try {
    if (evts.length) await supabase.from("gameplay_events").insert(evts);
  } catch { /* swallow */ }
}

export async function logError(
  message: string,
  stack?: string,
  context?: Record<string, unknown>,
) {
  try {
    // Dedupe: ignore the same error message within DEDUPE_WINDOW_MS
    const key = message.slice(0, 120);
    const now = Date.now();
    const last = recentErrorKeys.get(key) ?? 0;
    if (now - last < DEDUPE_WINDOW_MS) return;
    recentErrorKeys.set(key, now);
    if (recentErrorKeys.size > 200) {
      // GC old keys
      for (const [k, t] of recentErrorKeys) {
        if (now - t > DEDUPE_WINDOW_MS * 4) recentErrorKeys.delete(k);
      }
    }
    const user_id = await currentUserId();
    ERROR_BUFFER.push({
      user_id: user_id ?? undefined,
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 8000),
      url: typeof window !== "undefined" ? window.location.href : undefined,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      context: (context ?? undefined) as never,
    });
    if (ERROR_BUFFER.length > MAX_BUFFER) ERROR_BUFFER.splice(0, ERROR_BUFFER.length - MAX_BUFFER);
    scheduleFlush();
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
    EVENT_BUFFER.push({
      user_id: user_id ?? undefined,
      event_type,
      song_id: song_id ?? undefined,
      payload: (payload ?? undefined) as never,
    });
    if (EVENT_BUFFER.length > MAX_BUFFER) EVENT_BUFFER.splice(0, EVENT_BUFFER.length - MAX_BUFFER);
    scheduleFlush();
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

  // Flush on tab-hide so we don't lose buffered events on navigation.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushNow();
  });
  window.addEventListener("pagehide", () => { void flushNow(); });
}