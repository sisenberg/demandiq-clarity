-- ============================================================
-- SECURITY HARDENING: Fix storage policies for case-documents
-- The existing policies are NOT tenant-scoped, allowing any
-- authenticated user to read/upload any document in the bucket.
-- This migration replaces them with tenant-scoped policies.
-- ============================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "tenant_read_documents" ON storage.objects;
DROP POLICY IF EXISTS "tenant_upload_documents" ON storage.objects;

-- Tenant-scoped SELECT: user can only read objects under their tenant folder
CREATE POLICY "tenant_read_documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND (storage.foldername(name))[1] = (get_user_tenant_id(auth.uid()))::text
  );

-- Tenant-scoped INSERT: user can only upload to their tenant folder
CREATE POLICY "tenant_upload_documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'case-documents'
    AND (storage.foldername(name))[1] = (get_user_tenant_id(auth.uid()))::text
  );

-- Tenant-scoped DELETE: user can only delete objects under their tenant folder
CREATE POLICY "tenant_delete_documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND (storage.foldername(name))[1] = (get_user_tenant_id(auth.uid()))::text
  );

-- Tenant-scoped DELETE for derived-artifacts (was missing)
CREATE POLICY "tenant_delete_derived" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'derived-artifacts'
    AND (storage.foldername(name))[1] = (get_user_tenant_id(auth.uid()))::text
  );