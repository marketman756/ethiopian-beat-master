-- Match rooms (lobbies for score-race multiplayer)
CREATE TABLE public.match_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_id UUID NOT NULL,
  song_id TEXT,
  status TEXT NOT NULL DEFAULT 'lobby', -- lobby | playing | finished
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.match_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rooms viewable by everyone"
  ON public.match_rooms FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create rooms as host"
  ON public.match_rooms FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update their room"
  ON public.match_rooms FOR UPDATE
  USING (auth.uid() = host_id);

CREATE POLICY "Host can delete their room"
  ON public.match_rooms FOR DELETE
  USING (auth.uid() = host_id);

CREATE TRIGGER update_match_rooms_updated_at
  BEFORE UPDATE ON public.match_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_match_rooms_code ON public.match_rooms(code);
CREATE INDEX idx_match_rooms_status ON public.match_rooms(status);

-- Participants
CREATE TABLE public.match_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.match_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  combo INTEGER NOT NULL DEFAULT 0,
  max_combo INTEGER NOT NULL DEFAULT 0,
  accuracy NUMERIC(5,2) NOT NULL DEFAULT 0,
  finished BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants viewable by everyone"
  ON public.match_participants FOR SELECT USING (true);

CREATE POLICY "Users can join as themselves"
  ON public.match_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participant row"
  ON public.match_participants FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can leave (delete own row)"
  ON public.match_participants FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_match_participants_updated_at
  BEFORE UPDATE ON public.match_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_match_participants_room ON public.match_participants(room_id);

-- Realtime
ALTER TABLE public.match_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.match_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_participants;