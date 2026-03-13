
-- Fix security definer views to use security invoker
DROP VIEW IF EXISTS public.represented_vs_unrepresented_summary_v;
DROP VIEW IF EXISTS public.representation_transition_analytics_v;
DROP VIEW IF EXISTS public.severity_banded_representation_comparison_v;

CREATE VIEW public.represented_vs_unrepresented_summary_v
WITH (security_invoker = true) AS
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

CREATE VIEW public.representation_transition_analytics_v
WITH (security_invoker = true) AS
SELECT
  tenant_id,
  COUNT(*) FILTER (WHERE representation_status_at_first_evaluation = 'unrepresented') AS unrepresented_at_open_count,
  COUNT(*) FILTER (WHERE representation_status_at_first_evaluation = 'unrepresented' AND attorney_retained_during_claim_flag) AS retained_counsel_later_count,
  COUNT(*) FILTER (WHERE attorney_retained_after_initial_offer_flag) AS retained_after_initial_offer_count,
  ROUND(AVG(time_to_retention_days) FILTER (WHERE attorney_retained_during_claim_flag), 1) AS avg_days_to_retention,
  ROUND(AVG(final_settlement_amount) FILTER (
    WHERE representation_status_at_close = 'unrepresented' AND NOT attorney_retained_during_claim_flag AND final_settlement_amount IS NOT NULL
  ), 2) AS avg_settlement_if_never_retained,
  ROUND(AVG(final_settlement_amount) FILTER (
    WHERE representation_transition_flag AND attorney_retained_during_claim_flag AND final_settlement_amount IS NOT NULL
  ), 2) AS avg_settlement_if_retained_later
FROM public.representation_analytics_facts
GROUP BY tenant_id;

CREATE VIEW public.severity_banded_representation_comparison_v
WITH (security_invoker = true) AS
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
