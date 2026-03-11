# CasualtyIQ — Retention & Deletion

> **Status**: Intended retention treatment documented. No automated enforcement exists yet unless noted.

## 1. Retention Matrix

| Data Category | Location | Intended Retention | Deletion Trigger | Automated? | Notes |
|---|---|---|---|---|---|
| **Raw uploaded documents** | Storage: `case-documents` | Duration of case + 7 years | Case closure + retention period | ❌ No | Legal hold may extend; retention period TBD by customer policy |
| **OCR extracted text** | `case_documents.extracted_text`, `document_pages` | Same as source document | Document deletion | ❌ No | Re-extractable from source document if needed |
| **Document classifications** | `document_type_suggestions`, `document_metadata_extractions` | Same as source document | Document deletion | ❌ No | Re-extractable via AI pipeline |
| **Extracted facts** | `extracted_facts` | Same as source document | Document deletion | ❌ No | Contains L4 PHI — same retention as source |
| **Entity clusters** | `entity_clusters`, `entity_cluster_members` | Duration of case | Case deletion | ❌ No | Re-extractable; user corrections would be lost |
| **Chronology candidates** | `chronology_event_candidates`, `chronology_evidence_links` | Duration of case | Case deletion | ❌ No | Contains L4 PHI (medical events); user edits would be lost |
| **Case data** | `cases`, `case_parties`, `injuries`, `treatment_records`, `bills`, `insurance_policies`, `liability_facts` | Duration of case + 7 years | Case closure + retention period | ❌ No | Core claim data — longest retention |
| **Generated artifacts** | `generated_artifacts`, Storage: `derived-artifacts` | Duration of case + 7 years | Case closure + retention period | ❌ No | May be needed for dispute resolution |
| **Module completion state** | `module_completions`, `module_completion_snapshots`, `module_dependency_state` | Duration of case | Case deletion | ❌ No | Workflow state — no independent retention value |
| **Audit events** | `audit_events` | 7 years minimum | Time-based | ❌ No | Must outlive the data they describe; needed for compliance evidence |
| **Job history** | `jobs`, `intake_jobs` | 1 year after completion | Time-based | ❌ No | Operational — shorter retention acceptable |
| **User profiles** | `profiles`, `user_roles` | Duration of account + 30 days | Account deletion request | ❌ No | Subject to data subject access/deletion requests |
| **Tenant data** | `tenants`, `tenant_module_entitlements` | Duration of subscription + 90 days | Tenant offboarding | ❌ No | Admin data — low sensitivity |
| **Database backups** | Platform-managed | Platform default (7-30 days) | Automatic rotation | ✅ Platform | Backups may contain deleted data within retention window |
| **Seed / mock data** | `src/data/mock/` | Permanent (synthetic only) | N/A | N/A | Must remain synthetic — never contains real PHI/PII |

## 2. Deletion Capabilities (Current State)

### What CAN be deleted today

| Entity | Method | Cascade? | Notes |
|---|---|---|---|
| Individual document | Storage `remove()` + DB delete | Partial — `document_pages` FK cascade, but `extracted_facts` may orphan | Need to verify cascade behavior |
| Audit events | ❌ Cannot delete | N/A | By design — append-only |
| User profile | ❌ No self-service deletion | N/A | Would need admin action |
| Full case | ❌ No cascade delete | N/A | Would need to delete in dependency order |
| Full tenant | ❌ No offboarding mechanism | N/A | Critical gap for data subject requests |

### What CANNOT be deleted today

| Entity | Reason | Gap ID |
|---|---|---|
| Data from backups | Platform-managed; no selective purge | RET-001 |
| Data sent to AI gateway | External system; retention unknown | RET-002 |
| Specific PHI fields | No field-level deletion tool | RET-003 |

## 3. Legal Hold Considerations

- No legal hold mechanism exists
- When implemented, legal hold should:
  - Suspend all automated deletion for affected cases
  - Be tenant-scoped and case-scoped
  - Be auditable (who placed/lifted the hold)
  - Override retention schedules

## 4. Data Subject Rights

### Right to Deletion (GDPR Art. 17 / state privacy laws)

- **User data**: Can delete profile + role records manually; no self-service
- **Case data containing the individual**: Complex — cases may reference multiple individuals
- **Audit events referencing the individual**: Should NOT be deleted (audit integrity) — consider anonymizing actor_user_id instead
- **AI gateway data**: Cannot control — depends on subprocessor DPA

### Right to Access / Portability

- **User data**: Queryable from `profiles` table
- **Case data**: No tenant data export function exists (Gap BKP-003)

## 5. Implementation-Ready Gap List

| ID | Gap | Priority | Effort | Action |
|---|---|---|---|---|
| RET-001 | No automated time-based retention enforcement | High | High | Build a scheduled job to identify and queue expired data for deletion |
| RET-002 | AI gateway data retention unknown | High | Low | Document in subprocessor agreement; request retention policy from Lovable |
| RET-003 | No cascade delete for cases | Medium | Medium | Build a `delete_case` function that removes all related entities in order |
| RET-004 | No tenant offboarding / full purge | Medium | High | Build tenant data export + purge function |
| RET-005 | No legal hold mechanism | Medium | Medium | Add `legal_hold` flag to cases table; prevent deletion when set |
| RET-006 | No self-service data deletion for users | Low | Medium | Build user account deletion flow |
| RET-007 | Audit event actor anonymization for deleted users | Low | Low | Replace `actor_user_id` with `[deleted]` token on user deletion |
| RET-008 | Backup selective purge not possible | Low | N/A | Platform limitation — document and accept |
