
-- Allow authenticated users to delete their own tenant's documents
CREATE POLICY "delete_tenant_documents" ON public.case_documents
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Add file_hash column for duplicate detection
ALTER TABLE public.case_documents
  ADD COLUMN file_hash text;
