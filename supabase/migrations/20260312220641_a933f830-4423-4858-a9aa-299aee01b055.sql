
-- Attorney observations table for case-level + historical pattern data
CREATE TABLE public.attorney_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID REFERENCES public.cases(id),
  session_id UUID,
  attorney_name TEXT NOT NULL DEFAULT '',
  firm_name TEXT NOT NULL DEFAULT '',
  observation_type TEXT NOT NULL DEFAULT 'free_text',
  observation_text TEXT NOT NULL DEFAULT '',
  observed_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attorney_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_atty_obs" ON public.attorney_observations
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_atty_obs" ON public.attorney_observations
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_atty_obs" ON public.attorney_observations
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE INDEX idx_atty_obs_attorney ON public.attorney_observations(tenant_id, attorney_name);
CREATE INDEX idx_atty_obs_case ON public.attorney_observations(case_id);
