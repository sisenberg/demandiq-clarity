
-- Chronology event candidate status
CREATE TYPE public.chronology_candidate_status AS ENUM ('draft', 'accepted', 'suppressed', 'merged');

-- Chronology event category (matches TimelineCategory but as DB enum)
CREATE TYPE public.chronology_event_category AS ENUM (
  'accident', 'first_treatment', 'treatment', 'imaging', 'injection',
  'surgery', 'ime', 'demand', 'legal', 'administrative',
  'billing', 'correspondence', 'investigation', 'representation', 'other'
);

-- 1. Chronology event candidates — draft events from AI + user edits
CREATE TABLE public.chronology_event_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID NOT NULL REFERENCES public.cases(id),
  event_date TEXT NOT NULL DEFAULT '',
  event_date_end TEXT,
  category chronology_event_category NOT NULL DEFAULT 'other',
  label TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  confidence NUMERIC,
  status chronology_candidate_status NOT NULL DEFAULT 'draft',
  source_type TEXT NOT NULL DEFAULT 'ai_extracted',
  -- Machine-generated values preserved separately
  machine_label TEXT,
  machine_description TEXT,
  machine_date TEXT,
  machine_category TEXT,
  -- User corrections
  user_corrected_label TEXT,
  user_corrected_description TEXT,
  user_corrected_date TEXT,
  user_corrected_category TEXT,
  -- Merge tracking
  merged_into_id UUID REFERENCES public.chronology_event_candidates(id),
  -- Metadata
  source_document_id UUID REFERENCES public.case_documents(id),
  source_page INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chronology_event_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_chrono_candidates" ON public.chronology_event_candidates
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_insert_chrono_candidates" ON public.chronology_event_candidates
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_update_chrono_candidates" ON public.chronology_event_candidates
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- 2. Chronology evidence links — link events to source documents/pages
CREATE TABLE public.chronology_evidence_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID NOT NULL REFERENCES public.cases(id),
  candidate_id UUID NOT NULL REFERENCES public.chronology_event_candidates(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.case_documents(id),
  page_number INTEGER,
  quoted_text TEXT NOT NULL DEFAULT '',
  relevance_type TEXT NOT NULL DEFAULT 'direct',
  confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chronology_evidence_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_chrono_evidence" ON public.chronology_evidence_links
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_insert_chrono_evidence" ON public.chronology_evidence_links
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Indexes
CREATE INDEX idx_chrono_candidates_case ON public.chronology_event_candidates(case_id);
CREATE INDEX idx_chrono_candidates_status ON public.chronology_event_candidates(case_id, status);
CREATE INDEX idx_chrono_evidence_candidate ON public.chronology_evidence_links(candidate_id);

-- updated_at trigger
CREATE TRIGGER update_chrono_candidates_updated_at
  BEFORE UPDATE ON public.chronology_event_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
