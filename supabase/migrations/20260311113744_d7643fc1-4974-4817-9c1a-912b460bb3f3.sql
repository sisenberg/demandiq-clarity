
-- Enable realtime for intake_jobs and case_documents so the UI gets live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.intake_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_documents;
