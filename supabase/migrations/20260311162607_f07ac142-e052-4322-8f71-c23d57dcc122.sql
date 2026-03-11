
-- Environment type enum
CREATE TYPE public.environment_designation AS ENUM ('development', 'staging', 'production');

-- PHI readiness status enum
CREATE TYPE public.phi_readiness_status AS ENUM ('development_test_allowed', 'production_phi_blocked', 'production_phi_ready');

-- PHI readiness configuration table (one row per tenant)
CREATE TABLE public.phi_readiness_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  environment_designation environment_designation NOT NULL DEFAULT 'development',
  baa_executed BOOLEAN NOT NULL DEFAULT false,
  baa_vendor_list TEXT NOT NULL DEFAULT '',
  baa_confirmed_at TIMESTAMPTZ,
  baa_confirmed_by UUID,
  ai_retention_terms_finalized BOOLEAN NOT NULL DEFAULT false,
  ai_retention_notes TEXT NOT NULL DEFAULT '',
  ai_retention_confirmed_at TIMESTAMPTZ,
  ai_retention_confirmed_by UUID,
  logging_masking_hardened BOOLEAN NOT NULL DEFAULT false,
  logging_masking_confirmed_at TIMESTAMPTZ,
  logging_masking_confirmed_by UUID,
  overall_status phi_readiness_status NOT NULL DEFAULT 'development_test_allowed',
  last_status_change_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_status_change_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- RLS
ALTER TABLE public.phi_readiness_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_phi_config" ON public.phi_readiness_config
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "admin_manage_phi_config" ON public.phi_readiness_config
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER update_phi_readiness_config_updated_at
  BEFORE UPDATE ON public.phi_readiness_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
