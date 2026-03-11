
-- Entitlement status enum
CREATE TYPE public.module_entitlement_status AS ENUM ('enabled', 'disabled', 'trial', 'suspended');

-- Tenant module entitlements table
CREATE TABLE public.tenant_module_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  status module_entitlement_status NOT NULL DEFAULT 'disabled',
  trial_ends_at timestamptz,
  enabled_at timestamptz DEFAULT now(),
  enabled_by uuid,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, module_id)
);

-- RLS
ALTER TABLE public.tenant_module_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_entitlements" ON public.tenant_module_entitlements
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "admin_manage_entitlements" ON public.tenant_module_entitlements
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- Auto-seed DemandIQ as enabled for new tenants
CREATE OR REPLACE FUNCTION public.seed_base_modules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, status)
  VALUES (NEW.id, 'demandiq', 'enabled');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_base_modules
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_base_modules();

-- Seed existing tenants with DemandIQ
INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, status)
SELECT id, 'demandiq', 'enabled' FROM public.tenants
ON CONFLICT (tenant_id, module_id) DO NOTHING;

-- Updated_at trigger
CREATE TRIGGER trg_entitlements_updated_at
  BEFORE UPDATE ON public.tenant_module_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
