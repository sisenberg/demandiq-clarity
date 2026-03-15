-- Persist EvaluateIQ editable valuation inputs as versioned, demand-linked snapshots.

CREATE TABLE IF NOT EXISTS public.valuation_input_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_case_id UUID NOT NULL REFERENCES public.evaluation_cases(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_module TEXT NOT NULL,
  source_package_version INTEGER NOT NULL DEFAULT 1,
  upstream_snapshot_id TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valuation_input_snapshots_version_positive CHECK (version > 0),
  CONSTRAINT valuation_input_snapshots_source_module_check CHECK (source_module IN ('demandiq', 'revieweriq')),
  CONSTRAINT valuation_input_snapshots_eval_case_version_key UNIQUE (evaluation_case_id, version)
);

CREATE INDEX IF NOT EXISTS idx_valuation_input_snapshots_case_created_at
  ON public.valuation_input_snapshots (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_valuation_input_snapshots_eval_case_created_at
  ON public.valuation_input_snapshots (evaluation_case_id, created_at DESC);

ALTER TABLE public.valuation_input_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'valuation_input_snapshots'
      AND policyname = 'read_tenant_valuation_input_snapshots'
  ) THEN
    CREATE POLICY read_tenant_valuation_input_snapshots
    ON public.valuation_input_snapshots
    FOR SELECT
    TO authenticated
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'valuation_input_snapshots'
      AND policyname = 'insert_tenant_valuation_input_snapshots'
  ) THEN
    CREATE POLICY insert_tenant_valuation_input_snapshots
    ON public.valuation_input_snapshots
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END
$$;

ALTER TABLE public.evaluation_cases
ADD COLUMN IF NOT EXISTS active_valuation_input_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evaluation_cases_active_valuation_input_id_fkey'
  ) THEN
    ALTER TABLE public.evaluation_cases
    ADD CONSTRAINT evaluation_cases_active_valuation_input_id_fkey
    FOREIGN KEY (active_valuation_input_id)
    REFERENCES public.valuation_input_snapshots(id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.ensure_evaluation_case(_case_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _tenant_id UUID;
  _evaluation_case_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  _tenant_id := public.get_user_tenant_id(_user_id);
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'User tenant not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.cases
    WHERE id = _case_id
      AND tenant_id = _tenant_id
  ) THEN
    RAISE EXCEPTION 'Case not found or not accessible';
  END IF;

  INSERT INTO public.evaluation_cases (
    case_id,
    tenant_id,
    module_status,
    started_at,
    started_by,
    created_at,
    updated_at
  )
  VALUES (
    _case_id,
    _tenant_id,
    'valuation_in_review',
    now(),
    _user_id,
    now(),
    now()
  )
  ON CONFLICT (case_id, tenant_id)
  DO UPDATE SET
    module_status = CASE
      WHEN public.evaluation_cases.module_status = 'completed' THEN public.evaluation_cases.module_status
      ELSE 'valuation_in_review'
    END,
    updated_at = now()
  RETURNING id INTO _evaluation_case_id;

  RETURN _evaluation_case_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_valuation_input_snapshot(
  _case_id UUID,
  _snapshot_payload JSONB,
  _source_module TEXT,
  _source_package_version INTEGER,
  _upstream_snapshot_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  evaluation_case_id UUID,
  snapshot_id UUID,
  version INTEGER,
  created BOOLEAN,
  snapshot_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _tenant_id UUID;
  _evaluation_case_id UUID;
  _snapshot_id UUID;
  _version INTEGER;
  _created_at TIMESTAMP WITH TIME ZONE;
  _normalized_payload JSONB;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  _tenant_id := public.get_user_tenant_id(_user_id);
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'User tenant not found';
  END IF;

  IF _source_module NOT IN ('demandiq', 'revieweriq') THEN
    RAISE EXCEPTION 'Invalid source module';
  END IF;

  _evaluation_case_id := public.ensure_evaluation_case(_case_id);

  PERFORM 1
  FROM public.evaluation_cases
  WHERE id = _evaluation_case_id
  FOR UPDATE;

  SELECT vis.id, vis.version, vis.snapshot_payload, vis.created_at
  INTO _snapshot_id, _version, _normalized_payload, _created_at
  FROM public.valuation_input_snapshots vis
  WHERE vis.evaluation_case_id = _evaluation_case_id
  ORDER BY vis.version DESC
  LIMIT 1;

  IF _snapshot_id IS NOT NULL THEN
    UPDATE public.evaluation_cases
    SET active_valuation_input_id = _snapshot_id,
        updated_at = now()
    WHERE id = _evaluation_case_id;

    RETURN QUERY
    SELECT _evaluation_case_id, _snapshot_id, _version, false, _normalized_payload, _created_at;
    RETURN;
  END IF;

  _snapshot_id := gen_random_uuid();
  _version := 1;
  _created_at := now();
  _normalized_payload := COALESCE(_snapshot_payload, '{}'::jsonb) || jsonb_build_object(
    'snapshot_id', _snapshot_id,
    'case_id', _case_id,
    'tenant_id', _tenant_id,
    'version', _version,
    'created_at', _created_at,
    'created_by', _user_id,
    'source_module', _source_module,
    'source_package_version', COALESCE(_source_package_version, 1),
    'upstream_snapshot_id', _upstream_snapshot_id,
    'is_dirty', false,
    'last_saved_at', NULL
  );

  INSERT INTO public.valuation_input_snapshots (
    id,
    evaluation_case_id,
    case_id,
    tenant_id,
    version,
    snapshot_payload,
    source_module,
    source_package_version,
    upstream_snapshot_id,
    created_by,
    created_at
  )
  VALUES (
    _snapshot_id,
    _evaluation_case_id,
    _case_id,
    _tenant_id,
    _version,
    _normalized_payload,
    _source_module,
    COALESCE(_source_package_version, 1),
    _upstream_snapshot_id,
    _user_id,
    _created_at
  );

  UPDATE public.evaluation_cases
  SET active_valuation_input_id = _snapshot_id,
      updated_at = now()
  WHERE id = _evaluation_case_id;

  RETURN QUERY
  SELECT _evaluation_case_id, _snapshot_id, _version, true, _normalized_payload, _created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_valuation_input_snapshot(
  _case_id UUID,
  _snapshot_payload JSONB,
  _source_module TEXT,
  _source_package_version INTEGER,
  _upstream_snapshot_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  evaluation_case_id UUID,
  snapshot_id UUID,
  version INTEGER,
  snapshot_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _tenant_id UUID;
  _evaluation_case_id UUID;
  _snapshot_id UUID;
  _version INTEGER;
  _created_at TIMESTAMP WITH TIME ZONE;
  _normalized_payload JSONB;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  _tenant_id := public.get_user_tenant_id(_user_id);
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'User tenant not found';
  END IF;

  IF _source_module NOT IN ('demandiq', 'revieweriq') THEN
    RAISE EXCEPTION 'Invalid source module';
  END IF;

  _evaluation_case_id := public.ensure_evaluation_case(_case_id);

  PERFORM 1
  FROM public.evaluation_cases
  WHERE id = _evaluation_case_id
  FOR UPDATE;

  SELECT COALESCE(MAX(vis.version), 0) + 1
  INTO _version
  FROM public.valuation_input_snapshots vis
  WHERE vis.evaluation_case_id = _evaluation_case_id;

  _snapshot_id := gen_random_uuid();
  _created_at := now();
  _normalized_payload := COALESCE(_snapshot_payload, '{}'::jsonb) || jsonb_build_object(
    'snapshot_id', _snapshot_id,
    'case_id', _case_id,
    'tenant_id', _tenant_id,
    'version', _version,
    'created_at', _created_at,
    'created_by', _user_id,
    'source_module', _source_module,
    'source_package_version', COALESCE(_source_package_version, 1),
    'upstream_snapshot_id', _upstream_snapshot_id,
    'is_dirty', false,
    'last_saved_at', _created_at
  );

  INSERT INTO public.valuation_input_snapshots (
    id,
    evaluation_case_id,
    case_id,
    tenant_id,
    version,
    snapshot_payload,
    source_module,
    source_package_version,
    upstream_snapshot_id,
    created_by,
    created_at
  )
  VALUES (
    _snapshot_id,
    _evaluation_case_id,
    _case_id,
    _tenant_id,
    _version,
    _normalized_payload,
    _source_module,
    COALESCE(_source_package_version, 1),
    _upstream_snapshot_id,
    _user_id,
    _created_at
  );

  UPDATE public.evaluation_cases
  SET active_valuation_input_id = _snapshot_id,
      module_status = CASE
        WHEN module_status = 'completed' THEN 'valuation_in_review'
        ELSE module_status
      END,
      updated_at = now()
  WHERE id = _evaluation_case_id;

  RETURN QUERY
  SELECT _evaluation_case_id, _snapshot_id, _version, _normalized_payload, _created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_evaluation_case(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_evaluation_case(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.bootstrap_valuation_input_snapshot(UUID, JSONB, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_valuation_input_snapshot(UUID, JSONB, TEXT, INTEGER, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.append_valuation_input_snapshot(UUID, JSONB, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_valuation_input_snapshot(UUID, JSONB, TEXT, INTEGER, TEXT) TO authenticated;