import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

interface Profile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_guest: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInAsGuest: (displayName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe FIRST, then read existing session — required to avoid race.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s?.user) setProfile(null);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load profile whenever the user changes (deferred to avoid deadlock with auth event)
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, is_guest")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setProfile(data);
    }, 0);
    return () => clearTimeout(t);
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    user, session, profile, loading,
    signUp: async (email, password, displayName) => {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { display_name: displayName },
        },
      });
      return { error };
    },
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    },
    signInWithGoogle: async () => {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) return { error: result.error as Error };
      return { error: null };
    },
    signInAsGuest: async (displayName) => {
      const { error } = await supabase.auth.signInAnonymously({
        options: { data: { display_name: displayName, is_guest: true } },
      });
      return { error };
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
    },
  }), [user, session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}