ALTER TABLE public.evaluation_cases
  ADD COLUMN IF NOT EXISTS source_demand_package_id uuid REFERENCES public.intake_evaluation_packages(id),
  ADD COLUMN IF NOT EXISTS source_demand_package_version integer;