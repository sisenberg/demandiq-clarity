
-- Versioned calibration configuration for EvaluateIQ range engine
CREATE TABLE public.calibration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT false,
  
  -- Tunable parameters stored as structured JSON
  severity_multipliers jsonb NOT NULL DEFAULT '{}'::jsonb,
  clinical_adjustments jsonb NOT NULL DEFAULT '{}'::jsonb,
  reliability_reductions jsonb NOT NULL DEFAULT '{}'::jsonb,
  venue_multipliers jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  rounding_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Metadata
  change_reason text NOT NULL DEFAULT '',
  changed_by uuid NOT NULL,
  change_summary text NOT NULL DEFAULT '',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure only one active config per tenant
  UNIQUE(tenant_id, version)
);

ALTER TABLE public.calibration_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_cal_configs" ON public.calibration_configs
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_cal_configs" ON public.calibration_configs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_cal_configs" ON public.calibration_configs
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE INDEX idx_cal_configs_tenant_active ON public.calibration_configs(tenant_id, is_active);
