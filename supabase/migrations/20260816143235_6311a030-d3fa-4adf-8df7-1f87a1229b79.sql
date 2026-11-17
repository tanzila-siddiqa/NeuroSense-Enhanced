CREATE TABLE public.drawing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  screening_session_id uuid REFERENCES public.screening_sessions(id) ON DELETE SET NULL,
  task text NOT NULL CHECK (task IN ('spiral','circle','meander')),
  image_path text,
  duration_ms integer NOT NULL DEFAULT 0,
  point_count integer NOT NULL DEFAULT 0,
  stroke_count integer NOT NULL DEFAULT 0,
  avg_speed numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drawing_sessions TO authenticated;
GRANT ALL ON public.drawing_sessions TO service_role;
ALTER TABLE public.drawing_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own drawing sessions" ON public.drawing_sessions FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_drawing_sessions_updated_at BEFORE UPDATE ON public.drawing_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.drawing_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drawing_session_id uuid NOT NULL REFERENCES public.drawing_sessions(id) ON DELETE CASCADE,
  probability numeric NOT NULL,
  confidence numeric NOT NULL,
  is_demo boolean NOT NULL DEFAULT true,
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drawing_results TO authenticated;
GRANT ALL ON public.drawing_results TO service_role;
ALTER TABLE public.drawing_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own drawing results" ON public.drawing_results FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own drawings" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'drawings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own drawings" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'drawings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own drawings" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'drawings' AND auth.uid()::text = (storage.foldername(name))[1]);