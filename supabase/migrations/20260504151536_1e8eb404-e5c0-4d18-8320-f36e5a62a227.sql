
CREATE TABLE public.client_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can submit errors" ON public.client_errors
  FOR INSERT WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "users see their own errors" ON public.client_errors
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.gameplay_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  event_type TEXT NOT NULL,
  song_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gameplay_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can submit events" ON public.gameplay_events
  FOR INSERT WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "users see their own events" ON public.gameplay_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_client_errors_created ON public.client_errors(created_at DESC);
CREATE INDEX idx_gameplay_events_song ON public.gameplay_events(song_id, created_at DESC);
