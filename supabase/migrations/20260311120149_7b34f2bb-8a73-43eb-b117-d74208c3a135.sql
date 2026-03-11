
-- Entity clusters: case-level normalized entity groups
CREATE TABLE public.entity_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  entity_type text NOT NULL,  -- claimant, attorney, law_firm, provider, facility, claim_number, insurer
  display_value text NOT NULL DEFAULT '',
  canonical_value text,  -- user-corrected canonical name (null = display_value is canonical)
  confidence numeric,
  is_primary boolean NOT NULL DEFAULT false,
  source_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entity_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_clusters" ON public.entity_clusters
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_insert_clusters" ON public.entity_clusters
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_update_clusters" ON public.entity_clusters
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_delete_clusters" ON public.entity_clusters
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE INDEX idx_entity_clusters_case ON public.entity_clusters(case_id);
CREATE INDEX idx_entity_clusters_type ON public.entity_clusters(entity_type);

-- Entity cluster members: links individual extractions to clusters
CREATE TABLE public.entity_cluster_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  cluster_id uuid NOT NULL REFERENCES public.entity_clusters(id) ON DELETE CASCADE,
  extraction_id uuid REFERENCES public.document_metadata_extractions(id) ON DELETE SET NULL,
  raw_value text NOT NULL,
  document_id uuid REFERENCES public.case_documents(id) ON DELETE SET NULL,
  source_page integer,
  source_snippet text NOT NULL DEFAULT '',
  match_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entity_cluster_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_members" ON public.entity_cluster_members
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_insert_members" ON public.entity_cluster_members
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_update_members" ON public.entity_cluster_members
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_delete_members" ON public.entity_cluster_members
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE INDEX idx_cluster_members_cluster ON public.entity_cluster_members(cluster_id);
CREATE INDEX idx_cluster_members_document ON public.entity_cluster_members(document_id);
