/**
 * Document Processing State Machine
 *
 * Enforces valid state transitions and manages processing runs.
 * Every transition is persisted to document_state_transitions for auditability.
 */

import { supabase } from "@/integrations/supabase/client";

// ═══════════════════════════════════════════════════════
// PROCESSING STATES (ordered)
// ═══════════════════════════════════════════════════════

export const PROCESSING_STATES = [
  "upload_received",
  "validated",
  "queued",
  "processing",
  "parsed",
  "chunked",
  "indexed",
  "extraction_ready",
  "failed",
] as const;

export type ProcessingState = (typeof PROCESSING_STATES)[number];

export const PROCESSING_STATE_LABEL: Record<ProcessingState, string> = {
  uploaded: "Uploaded",
  validated: "Validated",
  queued: "Queued",
  processing: "Processing",
  parsed: "Parsed",
  chunked: "Chunked",
  indexed: "Indexed",
  extraction_ready: "Extraction Ready",
  failed: "Failed",
};

// ═══════════════════════════════════════════════════════
// VALID TRANSITIONS
// ═══════════════════════════════════════════════════════

const VALID_TRANSITIONS: Record<ProcessingState, ProcessingState[]> = {
  uploaded: ["validated", "failed"],
  validated: ["queued", "failed"],
  queued: ["processing", "failed"],
  processing: ["parsed", "failed"],
  parsed: ["chunked", "failed"],
  chunked: ["indexed", "failed"],
  indexed: ["extraction_ready", "failed"],
  extraction_ready: [],
  // From failed, allow restart to queued (reprocess)
  failed: ["queued", "uploaded"],
};

export function isValidTransition(from: ProcessingState, to: ProcessingState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getStateIndex(state: string): number {
  const idx = PROCESSING_STATES.indexOf(state as ProcessingState);
  return idx >= 0 ? idx : -1;
}

// ═══════════════════════════════════════════════════════
// PROCESSING RUN types
// ═══════════════════════════════════════════════════════

export type ProcessingRunStatus = "queued" | "running" | "completed" | "failed" | "partial";
export type TriggerReason = "initial" | "retry" | "reprocess" | "manual";

export interface ProcessingRun {
  id: string;
  document_id: string;
  case_id: string;
  tenant_id: string;
  run_number: number;
  run_status: ProcessingRunStatus;
  triggered_by: string | null;
  trigger_reason: TriggerReason;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  failure_stage: string | null;
  provider: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StateTransition {
  id: string;
  document_id: string;
  tenant_id: string;
  from_status: string | null;
  to_status: string;
  field_name: string;
  triggered_by: string;
  processing_run_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ═══════════════════════════════════════════════════════
// STATE MACHINE OPERATIONS
// ═══════════════════════════════════════════════════════

/**
 * Transition a document to a new pipeline_stage and log the transition.
 */
export async function transitionDocumentState({
  documentId,
  tenantId,
  fromStatus,
  toStatus,
  triggeredBy = "system",
  processingRunId,
  metadata = {},
}: {
  documentId: string;
  tenantId: string;
  fromStatus: string | null;
  toStatus: ProcessingState;
  triggeredBy?: string;
  processingRunId?: string;
  metadata?: Record<string, unknown>;
}): Promise<StateTransition> {
  // Update document pipeline_stage
  const { error: updateError } = await (supabase.from("case_documents") as any)
    .update({ pipeline_stage: toStatus })
    .eq("id", documentId);
  if (updateError) throw updateError;

  // Insert transition record
  const { data, error } = await (supabase.from("document_state_transitions") as any)
    .insert({
      document_id: documentId,
      tenant_id: tenantId,
      from_status: fromStatus,
      to_status: toStatus,
      field_name: "pipeline_stage",
      triggered_by: triggeredBy,
      processing_run_id: processingRunId || null,
      metadata,
    })
    .select()
    .single();
  if (error) throw error;
  return data as StateTransition;
}

/**
 * Create a new processing run for a document with auto-incremented run_number.
 */
export async function createProcessingRun({
  documentId,
  caseId,
  tenantId,
  triggeredBy,
  triggerReason = "initial",
}: {
  documentId: string;
  caseId: string;
  tenantId: string;
  triggeredBy: string;
  triggerReason?: TriggerReason;
}): Promise<ProcessingRun> {
  // Get current max run_number for this document
  const { data: existing } = await (supabase.from("document_processing_runs") as any)
    .select("run_number")
    .eq("document_id", documentId)
    .order("run_number", { ascending: false })
    .limit(1);

  const nextRunNumber = existing && existing.length > 0 ? existing[0].run_number + 1 : 1;

  const { data, error } = await (supabase.from("document_processing_runs") as any)
    .insert({
      document_id: documentId,
      case_id: caseId,
      tenant_id: tenantId,
      run_number: nextRunNumber,
      run_status: "queued",
      triggered_by: triggeredBy,
      trigger_reason: triggerReason,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ProcessingRun;
}

/**
 * Complete a processing run with optional error details.
 */
export async function completeProcessingRun({
  runId,
  status,
  errorDetails,
}: {
  runId: string;
  status: "completed" | "failed" | "partial";
  errorDetails?: {
    error_code?: string;
    error_message?: string;
    failure_stage?: string;
    provider?: string;
  };
}): Promise<void> {
  const update: Record<string, unknown> = {
    run_status: status,
    completed_at: new Date().toISOString(),
  };
  if (errorDetails) {
    if (errorDetails.error_code) update.error_code = errorDetails.error_code;
    if (errorDetails.error_message) update.error_message = errorDetails.error_message;
    if (errorDetails.failure_stage) update.failure_stage = errorDetails.failure_stage;
    if (errorDetails.provider) update.provider = errorDetails.provider;
  }

  const { error } = await (supabase.from("document_processing_runs") as any)
    .update(update)
    .eq("id", runId);
  if (error) throw error;
}

/**
 * Mark a processing run as started.
 */
export async function startProcessingRun(runId: string): Promise<void> {
  const { error } = await (supabase.from("document_processing_runs") as any)
    .update({
      run_status: "running",
      started_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw error;
}
