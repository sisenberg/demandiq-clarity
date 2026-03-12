
-- ═══════════════════════════════════════════════════════
-- EvaluateIQ Persistence Layer
-- ═══════════════════════════════════════════════════════

-- Enums
CREATE TYPE public.evaluation_case_status AS ENUM (
  'not_started', 'intake_ready', 'intake_in_progress',
  'valuation_ready', 'valuation_in_review', 'valued', 'completed'
);

CREATE TYPE public.valuation_run_type AS ENUM ('initial', 'refresh', 'manual_override');

CREATE TYPE public.driver_family AS ENUM (
  'injury_severity', 'treatment_intensity', 'liability', 'credibility',
  'venue', 'policy_limits', 'wage_loss', 'future_treatment',
  'permanency', 'surgery', 'imaging', 'pre_existing', 'other'
);

CREATE TYPE public.assumption_category AS ENUM (
  'liability', 'damages', 'comparative_fault', 'future_medical',
  'wage_loss', 'policy_limits', 'venue', 'credibility', 'other'
);

-- 1. evaluation_cases
CREATE TABLE public.evaluation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  module_status evaluation_case_status NOT NULL DEFAULT 'not_started',
  active_snapshot_id uuid,
  active_valuation_id uuid,
  started_at timestamptz,
  started_by uuid,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, tenant_id)
);

ALTER TABLE public.evaluation_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_eval_cases" ON public.evaluation_cases
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_eval_cases" ON public.evaluation_cases
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_eval_cases" ON public.evaluation_cases
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- 2. evaluation_snapshots
CREATE TABLE public.evaluation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  source_module text NOT NULL, -- 'demandiq' | 'revieweriq'
  source_package_version integer NOT NULL DEFAULT 1,
  source_snapshot_id uuid,
  snapshot_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  completeness_score numeric,
  completeness_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.evaluation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_eval_snapshots" ON public.evaluation_snapshots
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_eval_snapshots" ON public.evaluation_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- 3. valuation_driver_records
CREATE TABLE public.valuation_driver_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  valuation_run_id uuid, -- FK added after valuation_runs created
  snapshot_id uuid REFERENCES public.evaluation_snapshots(id),
  driver_family driver_family NOT NULL DEFAULT 'other',
  driver_key text NOT NULL DEFAULT '',
  raw_input_value text NOT NULL DEFAULT '',
  normalized_value numeric,
  score numeric,
  weight numeric,
  narrative text NOT NULL DEFAULT '',
  evidence_ref_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.valuation_driver_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_val_drivers" ON public.valuation_driver_records
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_val_drivers" ON public.valuation_driver_records
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_val_drivers" ON public.valuation_driver_records
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- 4. valuation_runs
CREATE TABLE public.valuation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  snapshot_id uuid REFERENCES public.evaluation_snapshots(id),
  run_type valuation_run_type NOT NULL DEFAULT 'initial',
  engine_version text NOT NULL DEFAULT 'v1.0',
  inputs_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  range_floor numeric,
  range_likely numeric,
  range_stretch numeric,
  confidence numeric,
  top_assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.valuation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_val_runs" ON public.valuation_runs
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_val_runs" ON public.valuation_runs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Add FK from valuation_driver_records -> valuation_runs
ALTER TABLE public.valuation_driver_records
  ADD CONSTRAINT valuation_driver_records_valuation_run_id_fkey
  FOREIGN KEY (valuation_run_id) REFERENCES public.valuation_runs(id);

-- 5. valuation_assumptions
CREATE TABLE public.valuation_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  valuation_run_id uuid REFERENCES public.valuation_runs(id),
  category assumption_category NOT NULL DEFAULT 'other',
  assumption_key text NOT NULL DEFAULT '',
  assumption_value text NOT NULL DEFAULT '',
  reason_notes text NOT NULL DEFAULT '',
  adopted_by uuid,
  adopted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.valuation_assumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_val_assumptions" ON public.valuation_assumptions
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_val_assumptions" ON public.valuation_assumptions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_val_assumptions" ON public.valuation_assumptions
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- 6. valuation_selections
CREATE TABLE public.valuation_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  valuation_run_id uuid REFERENCES public.valuation_runs(id),
  selected_floor numeric,
  selected_likely numeric,
  selected_stretch numeric,
  authority_recommendation numeric,
  rationale_notes text NOT NULL DEFAULT '',
  selected_by uuid,
  selected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, valuation_run_id)
);

ALTER TABLE public.valuation_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_val_selections" ON public.valuation_selections
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_val_selections" ON public.valuation_selections
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_val_selections" ON public.valuation_selections
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- 7. evaluation_packages
CREATE TABLE public.evaluation_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  version integer NOT NULL DEFAULT 1,
  snapshot_id uuid REFERENCES public.evaluation_snapshots(id),
  valuation_run_id uuid REFERENCES public.valuation_runs(id),
  selection_id uuid REFERENCES public.valuation_selections(id),
  package_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, version)
);

ALTER TABLE public.evaluation_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_eval_packages" ON public.evaluation_packages
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_eval_packages" ON public.evaluation_packages
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Add FK from evaluation_cases to snapshots and valuation_runs
ALTER TABLE public.evaluation_cases
  ADD CONSTRAINT evaluation_cases_active_snapshot_id_fkey
  FOREIGN KEY (active_snapshot_id) REFERENCES public.evaluation_snapshots(id);

ALTER TABLE public.evaluation_cases
  ADD CONSTRAINT evaluation_cases_active_valuation_id_fkey
  FOREIGN KEY (active_valuation_id) REFERENCES public.valuation_runs(id);

-- updated_at triggers
CREATE TRIGGER set_evaluation_cases_updated_at BEFORE UPDATE ON public.evaluation_cases FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_valuation_driver_records_updated_at BEFORE UPDATE ON public.valuation_driver_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_valuation_assumptions_updated_at BEFORE UPDATE ON public.valuation_assumptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_valuation_selections_updated_at BEFORE UPDATE ON public.valuation_selections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
