
-- Enums for representation status and event type
CREATE TYPE public.representation_status AS ENUM ('represented', 'unrepresented', 'unknown');
CREATE TYPE public.representation_event_type AS ENUM (
  'representation_status_recorded',
  'representation_confirmed_unrepresented',
  'attorney_retained',
  'attorney_substituted',
  'attorney_withdrew'
);

-- Shared claimant representation history table
CREATE TABLE public.claimant_representation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  claimant_id uuid NOT NULL REFERENCES public.case_parties(id),
  representation_status public.representation_status NOT NULL DEFAULT 'unknown',
  event_type public.representation_event_type NOT NULL DEFAULT 'representation_status_recorded',
  attorney_name text,
  firm_name text,
  source_party_id uuid REFERENCES public.case_parties(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by case+claimant
CREATE INDEX idx_rep_history_case_claimant ON public.claimant_representation_history(case_id, claimant_id, occurred_at DESC);
CREATE INDEX idx_rep_history_tenant ON public.claimant_representation_history(tenant_id);

-- Enable RLS
ALTER TABLE public.claimant_representation_history ENABLE ROW LEVEL SECURITY;

-- RLS policies (tenant-scoped, append-oriented)
CREATE POLICY "read_tenant_rep_history" ON public.claimant_representation_history
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_rep_history" ON public.claimant_representation_history
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- No UPDATE or DELETE — append-only by design

-- updated_at trigger
CREATE TRIGGER set_rep_history_updated_at
  BEFORE UPDATE ON public.claimant_representation_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
