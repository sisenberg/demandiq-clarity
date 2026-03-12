
-- ═══════════════════════════════════════════════════════════
-- EvaluateIQ Calibration Corpus — Historical Claims
-- ═══════════════════════════════════════════════════════════

-- Import batch tracking
CREATE TABLE public.calibration_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  import_type text NOT NULL DEFAULT 'csv' CHECK (import_type IN ('csv', 'json', 'document_packet')),
  file_name text NOT NULL DEFAULT '',
  record_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  imported_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.calibration_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_cal_imports" ON public.calibration_imports
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_cal_imports" ON public.calibration_imports
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_cal_imports" ON public.calibration_imports
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Historical closed claims
CREATE TABLE public.historical_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  import_id uuid REFERENCES public.calibration_imports(id),
  
  -- Outcome
  final_settlement_amount numeric,
  outcome_notes text NOT NULL DEFAULT '',

  -- Claim metadata
  loss_date date,
  venue_state text NOT NULL DEFAULT '',
  venue_county text NOT NULL DEFAULT '',
  jurisdiction text NOT NULL DEFAULT '',
  claim_number text NOT NULL DEFAULT '',

  -- Parties
  attorney_name text NOT NULL DEFAULT '',
  attorney_firm text NOT NULL DEFAULT '',
  provider_names text[] NOT NULL DEFAULT '{}',

  -- Injuries
  injury_categories text[] NOT NULL DEFAULT '{}',
  primary_body_parts text[] NOT NULL DEFAULT '{}',
  has_surgery boolean NOT NULL DEFAULT false,
  has_injections boolean NOT NULL DEFAULT false,
  has_imaging boolean NOT NULL DEFAULT false,
  has_hospitalization boolean NOT NULL DEFAULT false,
  has_permanency boolean NOT NULL DEFAULT false,

  -- Specials
  billed_specials numeric,
  reviewed_specials numeric,
  wage_loss numeric,

  -- Treatment
  treatment_duration_days integer,
  treatment_provider_count integer,

  -- Coverage
  policy_limits numeric,
  policy_type text NOT NULL DEFAULT '',

  -- Liability
  liability_posture text NOT NULL DEFAULT '' CHECK (liability_posture IN ('', 'clear', 'disputed', 'comparative', 'denied')),
  comparative_negligence_pct numeric,

  -- Data quality
  completeness_score numeric NOT NULL DEFAULT 0,
  confidence_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_source jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Corpus label
  corpus_type text NOT NULL DEFAULT 'calibration' CHECK (corpus_type IN ('calibration', 'benchmark')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.historical_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_hist_claims" ON public.historical_claims
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_hist_claims" ON public.historical_claims
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_hist_claims" ON public.historical_claims
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Indexes for calibration querying
CREATE INDEX idx_hist_claims_tenant ON public.historical_claims(tenant_id);
CREATE INDEX idx_hist_claims_attorney ON public.historical_claims(tenant_id, attorney_name);
CREATE INDEX idx_hist_claims_venue ON public.historical_claims(tenant_id, venue_state);
CREATE INDEX idx_hist_claims_settlement ON public.historical_claims(tenant_id, final_settlement_amount);
CREATE INDEX idx_hist_claims_loss_date ON public.historical_claims(tenant_id, loss_date);

-- Updated_at trigger
CREATE TRIGGER set_updated_at_historical_claims
  BEFORE UPDATE ON public.historical_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
