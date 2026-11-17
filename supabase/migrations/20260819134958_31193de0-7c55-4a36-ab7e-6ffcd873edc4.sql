CREATE TABLE public.fusion_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  screening_session_id uuid REFERENCES public.screening_sessions(id) ON DELETE SET NULL,
  drawing_result_id uuid REFERENCES public.drawing_results(id) ON DELETE SET NULL,
  voice_result_id uuid REFERENCES public.voice_results(id) ON DELETE SET NULL,
  drawing_probability numeric,
  voice_probability numeric,
  overall_probability numeric NOT NULL,
  confidence numeric NOT NULL,
  risk_category text NOT NULL DEFAULT 'low',
  drawing_weight numeric NOT NULL DEFAULT 0.5,
  voice_weight numeric NOT NULL DEFAULT 0.5,
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fusion_results TO authenticated;
GRANT ALL ON public.fusion_results TO service_role;

ALTER TABLE public.fusion_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own fusion results" ON public.fusion_results
  FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_fusion_results_updated_at
  BEFORE UPDATE ON public.fusion_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX fusion_results_user_created_idx ON public.fusion_results (user_id, created_at DESC);