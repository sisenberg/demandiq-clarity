
-- Add source_module column to track which module uploaded the document
ALTER TABLE public.case_documents 
ADD COLUMN IF NOT EXISTS source_module text NOT NULL DEFAULT 'general_intake';

-- Add comment for clarity
COMMENT ON COLUMN public.case_documents.source_module IS 'Module that uploaded this document: demandiq, evaluateiq, revieweriq, general_intake';
