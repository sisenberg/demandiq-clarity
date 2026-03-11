
-- Dependency status enum
CREATE TYPE public.dependency_status AS ENUM ('current', 'stale_due_to_upstream_change', 'refresh_needed');

-- Module dependency graph — defines which modules depend on which
CREATE TABLE public.module_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  downstream_module_id text NOT NULL,
  upstream_module_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (downstream_module_id, upstream_module_id)
);

-- Per-case dependency state — tracks freshness of upstream data consumed by each downstream module
CREATE TABLE public.module_dependency_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  downstream_module_id text NOT NULL,
  upstream_module_id text NOT NULL,
  dependency_status public.dependency_status NOT NULL DEFAULT 'current',
  upstream_snapshot_version integer,
  upstream_snapshot_id uuid REFERENCES public.module_completion_snapshots(id),
  last_synced_at timestamptz,
  stale_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, downstream_module_id, upstream_module_id)
);

-- Enable RLS
ALTER TABLE public.module_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_dependency_state ENABLE ROW LEVEL SECURITY;

-- module_dependencies is reference data — all authenticated can read
CREATE POLICY "read_dependencies" ON public.module_dependencies
  FOR SELECT TO authenticated USING (true);

-- module_dependency_state is tenant-scoped
CREATE POLICY "read_tenant_dep_state" ON public.module_dependency_state
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_dep_state" ON public.module_dependency_state
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_dep_state" ON public.module_dependency_state
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- updated_at trigger
CREATE TRIGGER set_updated_at_module_dependency_state
  BEFORE UPDATE ON public.module_dependency_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed the dependency graph: all downstream modules depend on DemandIQ
INSERT INTO public.module_dependencies (downstream_module_id, upstream_module_id) VALUES
  ('revieweriq', 'demandiq'),
  ('evaluateiq', 'demandiq'),
  ('negotiateiq', 'demandiq'),
  ('litiq', 'demandiq');
