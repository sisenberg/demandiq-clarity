
-- Add missing document types to the enum
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'demand_letter';
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'medical_bill';
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'itemized_statement';
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'narrative_report';
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'wage_loss_document';
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'unknown';

-- Add predicted_type to track AI prediction separately from final_type (document_type)
ALTER TABLE public.case_documents
ADD COLUMN IF NOT EXISTS predicted_type text;

COMMENT ON COLUMN public.case_documents.predicted_type IS 'AI-predicted document type before manual override. document_type holds the final accepted type.';
