
-- Negotiation session status enum
CREATE TYPE public.negotiation_session_status AS ENUM (
  'not_started',
  'strategy_ready',
  'active_negotiation',
  'pending_response',
  'settled',
  'impasse',
  'escalated',
  'closed_no_settlement',
  'transferred_to_litiq_candidate'
);

-- Negotiation event type enum
CREATE TYPE public.negotiation_event_type AS ENUM (
  'offer_made',
  'counteroffer_received',
  'hold',
  'bracket_proposed',
  'support_requested',
  'authority_adjusted',
  'draft_generated',
  'note_added',
  'session_completed',
  'status_changed',
  'strategy_override'
);

-- ── negotiation_sessions ────────────────────────────────
CREATE TABLE public.negotiation_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  eval_package_id uuid NOT NULL,
  eval_package_version integer NOT NULL DEFAULT 1,
  active_strategy_id uuid REFERENCES public.negotiate_strategies(id),
  status public.negotiation_session_status NOT NULL DEFAULT 'not_started',
  current_authority numeric,
  current_last_offer numeric,
  current_counteroffer numeric,
  current_range_floor numeric,
  current_range_ceiling numeric,
  final_settlement_amount numeric,
  final_outcome_notes text NOT NULL DEFAULT '',
  started_at timestamptz,
  started_by uuid,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.negotiation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_neg_sessions" ON public.negotiation_sessions
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_neg_sessions" ON public.negotiation_sessions
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "update_tenant_neg_sessions" ON public.negotiation_sessions
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── negotiation_rounds ──────────────────────────────────
CREATE TABLE public.negotiation_rounds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.negotiation_sessions(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  our_offer numeric,
  their_counteroffer numeric,
  our_offer_at timestamptz,
  their_counteroffer_at timestamptz,
  authority_at_round numeric,
  strategy_version_id uuid REFERENCES public.negotiate_strategies(id),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.negotiation_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_neg_rounds" ON public.negotiation_rounds
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_neg_rounds" ON public.negotiation_rounds
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "update_tenant_neg_rounds" ON public.negotiation_rounds
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── negotiation_events (timeline) ───────────────────────
CREATE TABLE public.negotiation_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.negotiation_sessions(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.negotiation_rounds(id),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type public.negotiation_event_type NOT NULL,
  actor_user_id uuid NOT NULL,
  summary text NOT NULL DEFAULT '',
  before_value jsonb,
  after_value jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.negotiation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_neg_events" ON public.negotiation_events
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_neg_events" ON public.negotiation_events
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── negotiation_notes ───────────────────────────────────
CREATE TABLE public.negotiation_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.negotiation_sessions(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.negotiation_rounds(id),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  note_type text NOT NULL DEFAULT 'general',
  is_internal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.negotiation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_neg_notes" ON public.negotiation_notes
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_neg_notes" ON public.negotiation_notes
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "update_tenant_neg_notes" ON public.negotiation_notes
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── negotiation_drafts ──────────────────────────────────
CREATE TABLE public.negotiation_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.negotiation_sessions(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.negotiation_rounds(id),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  draft_type text NOT NULL DEFAULT 'offer_letter',
  title text NOT NULL DEFAULT '',
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_text text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.negotiation_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_neg_drafts" ON public.negotiation_drafts
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_neg_drafts" ON public.negotiation_drafts
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "update_tenant_neg_drafts" ON public.negotiation_drafts
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── negotiation_outcomes ────────────────────────────────
CREATE TABLE public.negotiation_outcomes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.negotiation_sessions(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  outcome_type text NOT NULL DEFAULT 'settled',
  settlement_amount numeric,
  total_rounds integer NOT NULL DEFAULT 0,
  initial_offer numeric,
  initial_counteroffer numeric,
  final_offer numeric,
  final_counteroffer numeric,
  eval_range_floor numeric,
  eval_range_likely numeric,
  eval_range_stretch numeric,
  outcome_notes text NOT NULL DEFAULT '',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.negotiation_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_neg_outcomes" ON public.negotiation_outcomes
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_neg_outcomes" ON public.negotiation_outcomes
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── negotiation_counteroffers ───────────────────────────
CREATE TABLE public.negotiation_counteroffers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.negotiation_sessions(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.negotiation_rounds(id),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'received',
  amount numeric NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  source_channel text NOT NULL DEFAULT 'unknown',
  notes text NOT NULL DEFAULT '',
  attachment_path text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.negotiation_counteroffers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_neg_counteroffers" ON public.negotiation_counteroffers
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_neg_counteroffers" ON public.negotiation_counteroffers
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── negotiation_party_profiles ──────────────────────────
CREATE TABLE public.negotiation_party_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.negotiation_sessions(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  party_id uuid REFERENCES public.case_parties(id),
  party_role text NOT NULL DEFAULT 'claimant_attorney',
  display_name text NOT NULL DEFAULT '',
  firm_name text NOT NULL DEFAULT '',
  known_style text NOT NULL DEFAULT '',
  aggressiveness_rating integer,
  prior_case_notes text NOT NULL DEFAULT '',
  observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.negotiation_party_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_neg_party_profiles" ON public.negotiation_party_profiles
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_neg_party_profiles" ON public.negotiation_party_profiles
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "update_tenant_neg_party_profiles" ON public.negotiation_party_profiles
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
