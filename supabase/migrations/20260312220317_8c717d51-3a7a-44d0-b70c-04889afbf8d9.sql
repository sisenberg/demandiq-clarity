
-- NegotiateIQ: Draft versions table
CREATE TABLE public.negotiate_draft_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.negotiation_sessions(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  draft_type text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  external_content text NOT NULL DEFAULT '',
  internal_notes text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT 'neutral',
  version integer NOT NULL DEFAULT 1,
  is_final boolean NOT NULL DEFAULT false,
  context_snippets jsonb NOT NULL DEFAULT '[]'::jsonb,
  engine_version text NOT NULL DEFAULT '1.0.0',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.negotiate_draft_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_draft_versions" ON public.negotiate_draft_versions
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_draft_versions" ON public.negotiate_draft_versions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_draft_versions" ON public.negotiate_draft_versions
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Indexes
CREATE INDEX idx_draft_versions_session ON public.negotiate_draft_versions(session_id);
CREATE INDEX idx_draft_versions_case ON public.negotiate_draft_versions(case_id);
