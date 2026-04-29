
-- Profiles table (display name, avatar) — public-readable for leaderboard joins
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_guest BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Score submissions — every play attempt
CREATE TABLE public.score_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  max_combo INTEGER NOT NULL DEFAULT 0 CHECK (max_combo >= 0),
  perfects INTEGER NOT NULL DEFAULT 0 CHECK (perfects >= 0),
  greats INTEGER NOT NULL DEFAULT 0 CHECK (greats >= 0),
  cools INTEGER NOT NULL DEFAULT 0 CHECK (cools >= 0),
  misses INTEGER NOT NULL DEFAULT 0 CHECK (misses >= 0),
  total_notes INTEGER NOT NULL CHECK (total_notes > 0),
  accuracy NUMERIC(5,2) NOT NULL DEFAULT 0,
  stars SMALLINT NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
  duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.score_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_scores_song_score ON public.score_submissions (song_id, score DESC);
CREATE INDEX idx_scores_user ON public.score_submissions (user_id, created_at DESC);

CREATE POLICY "Scores are viewable by everyone"
  ON public.score_submissions FOR SELECT USING (true);

CREATE POLICY "Users can insert their own scores"
  ON public.score_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Per-user per-song best (denormalized for fast leaderboard reads)
CREATE TABLE public.user_song_bests (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL,
  best_score INTEGER NOT NULL DEFAULT 0,
  best_accuracy NUMERIC(5,2) NOT NULL DEFAULT 0,
  best_stars SMALLINT NOT NULL DEFAULT 0,
  best_max_combo INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);

ALTER TABLE public.user_song_bests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_bests_song_score ON public.user_song_bests (song_id, best_score DESC);

CREATE POLICY "Bests are viewable by everyone"
  ON public.user_song_bests FOR SELECT USING (true);

-- Generic timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, is_guest)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'Player' || substr(NEW.id::text, 1, 6)
    ),
    COALESCE((NEW.raw_user_meta_data ->> 'is_guest')::boolean, NEW.is_anonymous, false)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Server-side score validation + best-update via SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.submit_score(
  p_song_id TEXT,
  p_score INTEGER,
  p_max_combo INTEGER,
  p_perfects INTEGER,
  p_greats INTEGER,
  p_cools INTEGER,
  p_misses INTEGER,
  p_total_notes INTEGER,
  p_duration_ms INTEGER,
  p_stars INTEGER
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_judged INTEGER := p_perfects + p_greats + p_cools + p_misses;
  v_theoretical_max INTEGER := p_total_notes * 5; -- PERFECT base = 5
  v_accuracy NUMERIC(5,2);
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_total_notes <= 0 OR p_duration_ms <= 0 THEN
    RAISE EXCEPTION 'invalid_chart_meta';
  END IF;
  -- Anti-cheat: judged note count cannot exceed chart length
  IF v_judged > p_total_notes THEN
    RAISE EXCEPTION 'judgment_overflow';
  END IF;
  -- Anti-cheat: score cannot exceed theoretical max (5 pts × every note PERFECT)
  IF p_score > v_theoretical_max THEN
    RAISE EXCEPTION 'score_above_max';
  END IF;
  -- Anti-cheat: duration must be plausible (>= 5s)
  IF p_duration_ms < 5000 THEN
    RAISE EXCEPTION 'duration_too_short';
  END IF;

  v_accuracy := CASE
    WHEN v_judged = 0 THEN 0
    ELSE ROUND(((p_perfects::NUMERIC + p_greats * 0.6 + p_cools * 0.3) / v_judged) * 100, 2)
  END;

  INSERT INTO public.score_submissions (
    user_id, song_id, score, max_combo, perfects, greats, cools, misses,
    total_notes, accuracy, stars, duration_ms
  ) VALUES (
    v_uid, p_song_id, p_score, p_max_combo, p_perfects, p_greats, p_cools, p_misses,
    p_total_notes, v_accuracy, GREATEST(0, LEAST(3, p_stars)), p_duration_ms
  ) RETURNING id INTO v_id;

  -- Upsert best
  INSERT INTO public.user_song_bests AS b (
    user_id, song_id, best_score, best_accuracy, best_stars, best_max_combo, play_count
  ) VALUES (
    v_uid, p_song_id, p_score, v_accuracy, GREATEST(0, LEAST(3, p_stars)), p_max_combo, 1
  )
  ON CONFLICT (user_id, song_id) DO UPDATE SET
    best_score = GREATEST(b.best_score, EXCLUDED.best_score),
    best_accuracy = GREATEST(b.best_accuracy, EXCLUDED.best_accuracy),
    best_stars = GREATEST(b.best_stars, EXCLUDED.best_stars),
    best_max_combo = GREATEST(b.best_max_combo, EXCLUDED.best_max_combo),
    play_count = b.play_count + 1,
    updated_at = now();

  RETURN v_id;
END;
$$;
