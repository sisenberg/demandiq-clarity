-- Reset text_extraction job to queued for reprocessing
UPDATE intake_jobs SET status = 'queued', started_at = NULL, completed_at = NULL, error_message = NULL WHERE id = '1076a696-fa86-4dd8-ad5b-52a5352f6566';

-- Mark stuck duplicate_detection job as completed (no handler exists)
UPDATE intake_jobs SET status = 'completed', completed_at = now(), error_message = 'No handler — skipped' WHERE id = '5364e599-0737-44ab-8e3a-3e951c3406be';

-- Reset document back to upload_received so process-document can run fresh
UPDATE case_documents SET intake_status = 'uploaded', document_status = 'queued', pipeline_stage = 'upload_received', extracted_text = NULL, extracted_at = NULL WHERE id = '7a064923-6972-41c8-9de8-0a4c2b674ae1';

-- Delete old document_pages and parsed_document_pages for this doc
DELETE FROM document_pages WHERE document_id = '7a064923-6972-41c8-9de8-0a4c2b674ae1';
DELETE FROM parsed_document_pages WHERE document_id = '7a064923-6972-41c8-9de8-0a4c2b674ae1';

-- Delete old document_chunks for this doc
DELETE FROM document_chunks WHERE document_id = '7a064923-6972-41c8-9de8-0a4c2b674ae1';

-- Delete old classification suggestions
DELETE FROM document_type_suggestions WHERE document_id = '7a064923-6972-41c8-9de8-0a4c2b674ae1';