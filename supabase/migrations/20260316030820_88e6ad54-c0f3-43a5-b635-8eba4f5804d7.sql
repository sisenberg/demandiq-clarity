
-- 1. Extend pipeline_stage enum with new states
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'validated';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'chunked';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'indexed';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'extraction_ready';

-- 2. Extend intake_job_type enum
ALTER TYPE public.intake_job_type ADD VALUE IF NOT EXISTS 'validation';
ALTER TYPE public.intake_job_type ADD VALUE IF NOT EXISTS 'chunking';
ALTER TYPE public.intake_job_type ADD VALUE IF NOT EXISTS 'indexing';

-- 3. Create processing run status enum
DO $$ BEGIN
  CREATE TYPE public.processing_run_status AS ENUM ('queued','running','completed','failed','partial');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Create trigger reason enum
DO $$ BEGIN
  CREATE TYPE public.processing_trigger_reason AS ENUM ('initial','retry','reprocess','manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Create document_processing_runs table
CREATE TABLE IF NOT EXISTS public.document_processing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  run_number integer NOT NULL DEFAULT 1,
  run_status public.processing_run_status NOT NULL DEFAULT 'queued',
  triggered_by uuid,
  trigger_reason public.processing_trigger_reason NOT NULL DEFAULT 'initial',
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  failure_stage text,
  provider text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processing_runs_document ON public.document_processing_runs(document_id, run_number DESC);
CREATE INDEX IF NOT EXISTS idx_processing_runs_case ON public.document_processing_runs(case_id);

-- 6. Create document_state_transitions table (append-only audit)
CREATE TABLE IF NOT EXISTS public.document_state_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  from_status text,
  to_status text NOT NULL,
  field_name text NOT NULL DEFAULT 'pipeline_stage',
  triggered_by text NOT NULL DEFAULT 'system',
  processing_run_id uuid REFERENCES public.document_processing_runs(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_state_transitions_doc ON public.document_state_transitions(document_id, created_at);

-- 7. Add processing_run_id and structured error fields to intake_jobs
ALTER TABLE public.intake_jobs ADD COLUMN IF NOT EXISTS processing_run_id uuid REFERENCES public.document_processing_runs(id);
ALTER TABLE public.intake_jobs ADD COLUMN IF NOT EXISTS error_code text;
ALTER TABLE public.intake_jobs ADD COLUMN IF NOT EXISTS failure_stage text;
ALTER TABLE public.intake_jobs ADD COLUMN IF NOT EXISTS provider text;

-- 8. RLS on document_processing_runs
ALTER TABLE public.document_processing_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for processing runs" ON public.document_processing_runs
  FOR ALL USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- 9. RLS on document_state_transitions
ALTER TABLE public.document_state_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for state transitions" ON public.document_state_transitions
  FOR ALL USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- 10. updated_at trigger for processing runs
CREATE TRIGGER update_processing_runs_updated_at
  BEFORE UPDATE ON public.document_processing_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
