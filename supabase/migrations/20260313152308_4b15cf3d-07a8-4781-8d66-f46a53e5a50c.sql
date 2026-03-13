
-- ═══════════════════════════════════════════════════════════
-- Representation Analytics: Denormalized fact table + 3 views
-- ═══════════════════════════════════════════════════════════

-- 1. Denormalized analytics fact table
CREATE TABLE public.representation_analytics_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  
  -- Representation state tracking
  representation_status_at_first_evaluation text DEFAULT 'unknown',
  representation_status_at_latest_evaluation text DEFAULT 'unknown',
  representation_status_at_first_offer text,
  representation_status_at_settlement text,
  representation_status_at_transfer text,
  representation_status_at_close text DEFAULT 'unknown',
  representation_transition_flag boolean NOT NULL DEFAULT false,
  attorney_retained_during_claim_flag boolean NOT NULL DEFAULT false,
  attorney_retained_after_initial_offer_flag boolean NOT NULL DEFAULT false,
  unrepresented_resolved_flag boolean NOT NULL DEFAULT false,
  
  -- Valuation metrics
  fact_based_value_mid numeric,
  expected_resolution_mid numeric,
  final_settlement_amount numeric,
  settlement_to_fact_based_value_ratio numeric,
  settlement_to_expected_resolution_ratio numeric,
  
  -- Timing
  time_to_settlement_days integer,
  time_to_retention_days integer,
  
  -- Outcome
  litigation_transfer_flag boolean NOT NULL DEFAULT false,
  
  -- Normalization dimensions
  severity_band text,
  specials_band text,
  liability_band text,
  venue text,
  surgery_flag boolean,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, case_id)
);

-- RLS
ALTER TABLE public.representation_analytics_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for representation analytics"
  ON public.representation_analytics_facts
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_representation_analytics_facts_updated_at
  BEFORE UPDATE ON public.representation_analytics_facts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════════════════════════
-- View 1: represented_vs_unrepresented_summary_v
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.represented_vs_unrepresented_summary_v AS
SELECT
  tenant_id,
  COUNT(*) FILTER (WHERE representation_status_at_close = 'represented' AND NOT representation_transition_flag) AS represented_case_count,
  COUNT(*) FILTER (WHERE representation_status_at_close = 'unrepresented' AND NOT representation_transition_flag) AS unrepresented_case_count,
  COUNT(*) FILTER (WHERE representation_transition_flag) AS transitioned_case_count,
  
  ROUND(AVG(fact_based_value_mid) FILTER (WHERE representation_status_at_close = 'represented' AND NOT representation_transition_flag), 2) AS avg_fact_based_value_mid_represented,
  ROUND(AVG(fact_based_value_mid) FILTER (WHERE representation_status_at_close = 'unrepresented' AND NOT representation_transition_flag), 2) AS avg_fact_based_value_mid_unrepresented,
  
  ROUND(AVG(expected_resolution_mid) FILTER (WHERE representation_status_at_close = 'represented' AND NOT representation_transition_flag), 2) AS avg_expected_resolution_mid_represented,
  ROUND(AVG(expected_resolution_mid) FILTER (WHERE representation_status_at_close = 'unrepresented' AND NOT representation_transition_flag), 2) AS avg_expected_resolution_mid_unrepresented,
  
  ROUND(AVG(final_settlement_amount) FILTER (WHERE representation_status_at_close = 'represented' AND NOT representation_transition_flag), 2) AS avg_final_settlement_represented,
  ROUND(AVG(final_settlement_amount) FILTER (WHERE representation_status_at_close = 'unrepresented' AND NOT representation_transition_flag), 2) AS avg_final_settlement_unrepresented
FROM public.representation_analytics_facts
GROUP BY tenant_id;

-- ═══════════════════════════════════════════════════════════
-- View 2: representation_transition_analytics_v
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.representation_transition_analytics_v AS
SELECT
  tenant_id,
  COUNT(*) FILTER (WHERE representation_status_at_first_evaluation = 'unrepresented') AS unrepresented_at_open_count,
  COUNT(*) FILTER (WHERE representation_status_at_first_evaluation = 'unrepresented' AND attorney_retained_during_claim_flag) AS retained_counsel_later_count,
  COUNT(*) FILTER (WHERE attorney_retained_after_initial_offer_flag) AS retained_after_initial_offer_count,
  
  ROUND(AVG(time_to_retention_days) FILTER (WHERE attorney_retained_during_claim_flag), 1) AS avg_days_to_retention,
  
  ROUND(AVG(final_settlement_amount) FILTER (
    WHERE representation_status_at_close = 'unrepresented' 
    AND NOT attorney_retained_during_claim_flag 
    AND final_settlement_amount IS NOT NULL
  ), 2) AS avg_settlement_if_never_retained,
  
  ROUND(AVG(final_settlement_amount) FILTER (
    WHERE representation_transition_flag 
    AND attorney_retained_during_claim_flag 
    AND final_settlement_amount IS NOT NULL
  ), 2) AS avg_settlement_if_retained_later
FROM public.representation_analytics_facts
GROUP BY tenant_id;

-- ═══════════════════════════════════════════════════════════
-- View 3: severity_banded_representation_comparison_v
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.severity_banded_representation_comparison_v AS
SELECT
  tenant_id,
  COALESCE(severity_band, 'Unknown') AS severity_band,
  CASE
    WHEN representation_transition_flag THEN 'transitioned'
    ELSE COALESCE(representation_status_at_close, 'unknown')
  END AS representation_status_at_close,
  COUNT(*) AS claim_count,
  ROUND(AVG(fact_based_value_mid), 2) AS avg_fact_based_value_mid,
  ROUND(AVG(final_settlement_amount), 2) AS avg_final_settlement,
  ROUND(AVG(settlement_to_fact_based_value_ratio), 4) AS avg_settlement_to_fact_based_ratio
FROM public.representation_analytics_facts
WHERE final_settlement_amount IS NOT NULL
GROUP BY tenant_id, 
  COALESCE(severity_band, 'Unknown'),
  CASE
    WHEN representation_transition_flag THEN 'transitioned'
    ELSE COALESCE(representation_status_at_close, 'unknown')
  END;
