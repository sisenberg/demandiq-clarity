# CasualtyIQ — Audit Event Catalog

> **Status**: Readiness hardening baseline. Not a certification claim.

## 1. Audit Infrastructure

**Table**: `audit_events`
**Hook**: `src/hooks/useAuditLog.ts` → `useAuditLog()`

### Event Schema

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | UUID | Auto-generated | Primary key |
| `actor_user_id` | UUID | `auth.uid()` via AuthContext | Always the authenticated user |
| `tenant_id` | UUID | AuthContext | Enforced by RLS — cannot log cross-tenant |
| `action_type` | text | Application code | See catalog below |
| `entity_type` | text | Application code | e.g., `case_document`, `chronology_event_candidate` |
| `entity_id` | text | Application code | UUID of affected entity |
| `case_id` | UUID | Application code | Nullable — not all actions are case-scoped |
| `before_value` | JSONB | Application code | Previous state snapshot (for changes) |
| `after_value` | JSONB | Application code | New state snapshot |
| `created_at` | timestamptz | `now()` default | Server-side timestamp |

### Fields NOT Currently Captured

| Field | Status | Notes |
|---|---|---|
| Source IP | ❌ Not captured | Supabase edge functions can read `req.headers.get("x-forwarded-for")` but client-side audit calls cannot |
| User agent | ❌ Not captured | Same limitation as IP |
| Success/failure | ⚠️ Partial | Audit is only written on success; failures are not logged to audit_events |
| Session ID | ❌ Not captured | No session tracking implemented |

## 2. Event Catalog

### Currently Implemented ✅

| Action Type | Entity Type | Trigger Location | Before/After | Notes |
|---|---|---|---|---|
| `document_uploaded` | `case_document` | `useUploadDocuments` | after: file_name, file_type, size, type | Tracks every document upload |
| `signed_url_generated` | `case_document` | `DocumentReviewWorkspace`, `IntakeDocumentsWorkstation` | after: ttl, purpose | Tracks signed URL creation for viewer and view-original |
| `metadata_corrected` | `document_metadata_extractions` | `DocumentMetadataPanel` | before/after: value | Tracks manual correction of AI-extracted metadata |
| `document_type_changed` | `case_document` | `DocumentMetadataPanel` | before/after: type | Tracks manual type acceptance |
| `fact_reviewed` | `extracted_fact` | `DocumentReviewWorkspace` | after: reviewed status | Tracks fact acceptance |
| `chronology_status_changed` | `chronology_event_candidate` | `DraftChronologyPanel`, `DocumentReviewWorkspace` | before/after: status | Tracks accept/suppress |
| `chronology_edited` | `chronology_event_candidate` | `DraftChronologyPanel` | before/after: fields | Tracks manual edits to events |
| `chronology_merged` | `chronology_event_candidate` | `DraftChronologyPanel` | after: source_id, target_id | Tracks event merges |
| `entity_renamed` | `entity_cluster` | `DetectedEntitiesPanel` | before/after: display_value | Tracks entity name changes |
| `entity_merged` | `entity_cluster` | `DetectedEntitiesPanel` | after: source_id, target_id | Tracks cluster merges |
| `entity_primary_set` | `entity_cluster` | `DetectedEntitiesPanel` | after: cluster_id | Tracks primary entity selection |
| `role_changed` | `user_role` | `AdminPage` | before/after: role | Tracks role assignment changes |
| `entitlement_changed` | `module_entitlement` | `AdminPage` | before/after: status | Tracks module enable/disable |
| `processing_triggered` | `intake_job` | `DocumentReviewWorkspace` | after: job_type | Tracks manual reprocessing |

### Defined But Not Yet Emitted ⚠️

| Action Type | Where It Should Be | Gap |
|---|---|---|
| `document_accessed` | Document detail page load | No audit call on view — low priority (signed_url_generated covers access) |
| `artifact_exported` | `ExportsPage` | Export is placeholder/TODO — add when real export implemented |
| `entity_split` | Entity management | Feature not yet built |

### Not Yet Defined — Recommended Additions 🔲

| Action Type | Entity Type | Trigger | Priority | Notes |
|---|---|---|---|---|
| `login_success` | `auth_session` | Auth callback / sign-in | Medium | Requires server-side hook or Supabase auth webhook |
| `login_failed` | `auth_session` | Auth error handler | Medium | Same — needs auth event hook |
| `logout` | `auth_session` | Sign-out action | Low | User-initiated signout |
| `case_created` | `case` | `CreateCaseDialog` | Medium | Track new case creation |
| `case_status_changed` | `case` | Status transitions | Medium | Track workflow progression |
| `module_completed` | `module_completion` | `useModuleCompletion` | Medium | Already writes audit inline — should use standard hook |
| `module_reopened` | `module_completion` | `useModuleCompletion` | Medium | Same |
| `document_deleted` | `case_document` | Delete action | High | Track evidence removal |
| `bulk_reprocessing` | `intake_job` | Batch reprocess | Medium | Track privileged batch operations |

## 3. RLS on Audit Events

- **INSERT**: Authenticated users can insert events for their own tenant only
- **SELECT**: Authenticated users can read events for their own tenant only
- **UPDATE**: ❌ Prohibited — audit events are append-only
- **DELETE**: ❌ Prohibited — audit events cannot be removed

This is the correct configuration for audit immutability within the application layer.

## 4. Retention

Audit events have no automated retention/deletion mechanism. See [retention-and-deletion.md](./retention-and-deletion.md) for intended policy.
