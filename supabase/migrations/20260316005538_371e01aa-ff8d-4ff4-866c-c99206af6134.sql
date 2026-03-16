
-- Add columns to link demands to normalized party records
ALTER TABLE public.demands
ADD COLUMN IF NOT EXISTS claimant_party_id uuid REFERENCES public.case_parties(id),
ADD COLUMN IF NOT EXISTS attorney_party_id uuid REFERENCES public.case_parties(id);

COMMENT ON COLUMN public.demands.claimant_party_id IS 'FK to normalized claimant party record';
COMMENT ON COLUMN public.demands.attorney_party_id IS 'FK to normalized attorney party record';
