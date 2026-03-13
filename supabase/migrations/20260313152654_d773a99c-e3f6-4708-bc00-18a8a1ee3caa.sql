
-- ═══════════════════════════════════════════════════════════
-- Backfill: Set representation_status defaults for legacy data
-- Safe: only touches rows where representation is not yet set
-- ═══════════════════════════════════════════════════════════

-- 1. Backfill any existing claimant_representation_history rows
--    that have NULL representation_status to 'unknown'
UPDATE public.claimant_representation_history
SET representation_status = 'unknown'
WHERE representation_status IS NULL;

-- 2. Backfill representation_analytics_facts for existing cases
--    that don't yet have a fact row
INSERT INTO public.representation_analytics_facts (
  tenant_id, case_id,
  representation_status_at_first_evaluation,
  representation_status_at_latest_evaluation,
  representation_status_at_close,
  representation_transition_flag,
  attorney_retained_during_claim_flag,
  attorney_retained_after_initial_offer_flag,
  unrepresented_resolved_flag,
  litigation_transfer_flag
)
SELECT
  c.tenant_id,
  c.id,
  'unknown',
  'unknown',
  'unknown',
  false,
  false,
  false,
  false,
  false
FROM public.cases c
WHERE NOT EXISTS (
  SELECT 1 FROM public.representation_analytics_facts raf
  WHERE raf.case_id = c.id AND raf.tenant_id = c.tenant_id
)
ON CONFLICT (tenant_id, case_id) DO NOTHING;
