
CREATE TABLE public.dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modality text NOT NULL CHECK (modality IN ('drawing','voice')),
  version integer NOT NULL,
  storage_path text NOT NULL,
  original_filename text,
  status text NOT NULL DEFAULT 'processing',
  total_files integer NOT NULL DEFAULT 0,
  valid_files integer NOT NULL DEFAULT 0,
  invalid_files integer NOT NULL DEFAULT 0,
  duplicate_files integer NOT NULL DEFAULT 0,
  class_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  notes text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modality, version)
);

CREATE TABLE public.dataset_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version_id uuid NOT NULL REFERENCES public.dataset_versions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  class_label text NOT NULL DEFAULT 'unlabeled',
  file_size integer NOT NULL DEFAULT 0,
  file_hash text,
  status text NOT NULL DEFAULT 'valid',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dataset_samples_version_idx ON public.dataset_samples(dataset_version_id);

CREATE TABLE public.training_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version_id uuid REFERENCES public.dataset_versions(id) ON DELETE SET NULL,
  modality text NOT NULL CHECK (modality IN ('drawing','voice')),
  architecture text NOT NULL,
  epochs integer NOT NULL DEFAULT 20,
  batch_size integer NOT NULL DEFAULT 32,
  train_split numeric NOT NULL DEFAULT 0.7,
  val_split numeric NOT NULL DEFAULT 0.15,
  test_split numeric NOT NULL DEFAULT 0.15,
  augmentation boolean NOT NULL DEFAULT true,
  class_balancing text NOT NULL DEFAULT 'none',
  status text NOT NULL DEFAULT 'queued',
  external_job_id text,
  metrics jsonb,
  curves jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modality text NOT NULL CHECK (modality IN ('drawing','voice')),
  version integer NOT NULL,
  training_job_id uuid REFERENCES public.training_jobs(id) ON DELETE SET NULL,
  dataset_version_id uuid REFERENCES public.dataset_versions(id) ON DELETE SET NULL,
  metrics jsonb,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive','active','archived')),
  activated_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modality, version)
);
CREATE UNIQUE INDEX model_versions_one_active_per_modality
  ON public.model_versions(modality) WHERE status = 'active';

CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dataset_versions TO authenticated;
GRANT ALL ON public.dataset_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dataset_samples TO authenticated;
GRANT ALL ON public.dataset_samples TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_jobs TO authenticated;
GRANT ALL ON public.training_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_versions TO authenticated;
GRANT ALL ON public.model_versions TO service_role;
GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

ALTER TABLE public.dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage dataset versions" ON public.dataset_versions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage dataset samples" ON public.dataset_samples
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage training jobs" ON public.training_jobs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage model versions" ON public.model_versions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view audit logs" ON public.admin_audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins write audit logs" ON public.admin_audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND actor_id = auth.uid());

CREATE TRIGGER update_training_jobs_updated_at BEFORE UPDATE ON public.training_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins read datasets" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'datasets' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins upload datasets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'datasets' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update datasets" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'datasets' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete datasets" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'datasets' AND public.has_role(auth.uid(),'admin'));
