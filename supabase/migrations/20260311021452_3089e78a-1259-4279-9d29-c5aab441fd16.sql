
-- Enum for module completion status
CREATE TYPE public.module_completion_status AS ENUM ('not_started', 'in_progress', 'completed', 'reopened');

-- Module completions table — tracks lifecycle state per module per case
CREATE TABLE public.module_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  module_id text NOT NULL,
  status public.module_completion_status NOT NULL DEFAULT 'not_started',
  version integer NOT NULL DEFAULT 1,
  completed_by uuid,
  completed_at timestamptz,
  reopened_by uuid,
  reopened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, module_id)
);

-- Module completion snapshots — versioned snapshot of data at completion time
CREATE TABLE public.module_completion_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  module_id text NOT NULL,
  completion_id uuid NOT NULL REFERENCES public.module_completions(id),
  version integer NOT NULL DEFAULT 1,
  snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (completion_id, version)
);

-- Audit events table (real, not mock)
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid,
  actor_user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action_type text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.module_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_completion_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for module_completions
CREATE POLICY "read_tenant_completions" ON public.module_completions
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_completions" ON public.module_completions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_completions" ON public.module_completions
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS policies for module_completion_snapshots
CREATE POLICY "read_tenant_snapshots" ON public.module_completion_snapshots
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_snapshots" ON public.module_completion_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS policies for audit_events
CREATE POLICY "read_tenant_audit" ON public.audit_events
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_audit" ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- updated_at triggers
CREATE TRIGGER set_updated_at_module_completions
  BEFORE UPDATE ON public.module_completions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
