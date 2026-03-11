# CasualtyIQ — Security/Compliance Readiness Report (SC-1 through SC-5)

> **Generated**: 2026-03-11
> **Scope**: Architecture hardening validation for SOC 2 Type II readiness and HIPAA-safe architecture readiness
> **Disclaimer**: This is NOT a certification claim. This is a self-assessment of technical architecture posture.

---

## Overall Result: **READY WITH MATERIAL GAPS**

The application architecture has a solid foundation for SOC 2 Type II and HIPAA-safe operation. Data classification, tenant isolation, audit logging, and PHI boundary controls are materially in place. **Two blockers** prevent production PHI handling today, both related to subprocessor agreements rather than code defects.

**ReviewerIQ foundation work may proceed now.** The blockers are contractual, not architectural, and do not affect the correctness or safety of the codebase for continued development with synthetic data.

---

## SECTION 1: SOC 2 Architecture Readiness

### Blockers — None (architecture level)

No architectural blockers for SOC 2 readiness. All SOC 2 concerns are operational/policy (see Section 3).

### Major Findings

| ID | What Was Checked | What Was Found | Why It Matters | Recommended Fix |
|---|---|---|---|---|
| S2-M1 | Login/logout audit trail | Auth events (login_success, login_failed, logout) are **defined in audit catalog but not emitted**. AuthContext has no audit hook. | SOC 2 CC6.1 requires logging of authentication events. Without this, login anomaly detection is impossible. | Add `useAuditLog` call on auth state changes in `AuthContext.tsx`. For failures, consider a lightweight edge function triggered by Supabase Auth webhook. |
| S2-M2 | Case creation audit | `case_created` is listed as recommended but not implemented in `CreateCaseDialog`. | SOC 2 CC7.2 requires tracking of data creation events for PHI-containing entities. | Add audit call in case creation flow. |
| S2-M3 | MFA for admin accounts | No MFA configured (GAP-010 in control-gap-register). | SOC 2 CC6.1 requires strong authentication for privileged users. | Enable MFA via Supabase Auth for admin role. |
| S2-M4 | Session timeout configuration | Uses Supabase Auth defaults. No configurable session timeout. | SOC 2 CC6.1 requires session management controls. | Configure `session_expiry` in Supabase Auth settings. |

### Minor Findings

| ID | What Was Checked | What Was Found | Why It Matters | Recommended Fix |
|---|---|---|---|---|
| S2-m1 | Audit event IP/user-agent capture | Not captured. Client-side audit calls cannot access source IP. | SOC 2 CC7.3 recommends source identification for security events. | Accept as limitation. Document that IP logging requires server-side audit insertion (edge function). |
| S2-m2 | Audit event success/failure tracking | Audit events are only written on success; failures are not logged. | Incomplete picture for security monitoring. | Add failure-path audit logging for critical operations (document upload failures, processing failures). |
| S2-m3 | Change management process | Documented in `change-management-notes.md` but no enforcement mechanism. | SOC 2 CC8.1 requires controlled change processes. | Acceptable for current stage. Enforce via PR review discipline. |

---

## SECTION 2: HIPAA-Safe Architecture Readiness

### Blockers

| ID | What Was Checked | What Was Found | Why It Matters | Recommended Fix |
|---|---|---|---|---|
| H-B1 | BAA with AI subprocessor | **No BAA exists with Lovable AI Gateway or upstream model providers** (GAP-002). All four edge functions send L3–L4 data to `ai.gateway.lovable.dev`. | HIPAA §164.502(e) requires a BAA with any entity that handles PHI on behalf of a covered entity. Without it, every AI call is a potential violation. | Execute BAA with Lovable. Confirm upstream model provider coverage. **This is the single most important gap.** |
| H-B2 | AI gateway data retention policy | Unknown whether the AI gateway or upstream models retain request/response payloads containing PHI. | HIPAA §164.530(j) requires documentation of PHI disclosures. If the gateway retains PHI, it must be accounted for. | Obtain written confirmation of data retention policy from Lovable AI Gateway. Document in subprocessor agreements. |

### Major Findings

| ID | What Was Checked | What Was Found | Why It Matters | Recommended Fix |
|---|---|---|---|---|
| H-M1 | Field-level encryption for PHI at rest | Not implemented. Relies on Supabase infrastructure-level disk encryption (AES-256). `extracted_text`, `fact_text` are stored in plaintext in the database. | HIPAA §164.312(a)(2)(iv) requires encryption of ePHI at rest. Infrastructure encryption satisfies this for most auditors, but field-level encryption provides defense-in-depth. | Document infrastructure encryption as the current control. Evaluate pgcrypto for `extracted_text` and `fact_text` if BAA terms require it. |
| H-M2 | `classify-document` sends unnecessary PII | First 8000 chars of document text sent to AI. SSNs, phone numbers, emails embedded in text are not stripped. | Minimum necessary principle (§164.502(b)). More PHI transmitted than needed for classification. | Add regex-based PII stripping (SSN, phone, email patterns) before sending text to AI in `classify-document`. |
| H-M3 | `generate-chronology` sends large PHI blocks | Up to 20000 chars of medical narrative text sent to AI. Cannot be meaningfully reduced without destroying function. | Minimum necessary principle. Acknowledged as unavoidable for this function. | Document as accepted risk. Ensure BAA covers this path. Consider chunking to reduce per-request exposure. |
| H-M4 | `audit_events.before_value`/`after_value` may contain PII | Audit events store before/after JSON snapshots that may include claimant names, metadata values, etc. | PHI in audit logs creates a secondary exposure surface. | Acceptable — audit integrity requires preserving change context. Ensure audit_events has same retention treatment as source data. |
| H-M5 | No document deletion cascade | Deleting a document does not cascade-delete `extracted_facts`, `chronology_event_candidates`, or other derived PHI. | HIPAA §164.530(j) — inability to fully purge an individual's PHI on request. | Build a `delete_document_cascade` function that removes all derived data. |

### Minor Findings

| ID | What Was Checked | What Was Found | Why It Matters | Recommended Fix |
|---|---|---|---|---|
| H-m1 | Signed URL TTLs | Reduced to 120–300s. Good improvement from prior state. | Short-lived URLs reduce window of exposure if URLs leak. | Current values are acceptable. |
| H-m2 | Storage bucket RLS | Both buckets (`case-documents`, `derived-artifacts`) are private with tenant-scoped RLS. | Correct configuration. | No action needed. |
| H-m3 | `sanitizeForLog` utility exists | Comprehensive PII field list, deep-sanitizes objects for logging. | Good control for preventing PII in application logs. | Ensure it's used consistently in all new code paths. |
| H-m4 | Non-production data safety | Mock data uses synthetic names. Compliance guardrail comment exists in `src/data/mock/index.ts` and `cases.ts`. | Prevents accidental PHI in seed data. | Acceptable. Consider adding a CI lint rule. |

---

## SECTION 3: Operational/Policy Gaps Outside the App

These are not code defects but organizational/process gaps that will be required for formal compliance:

| ID | Gap | SOC 2 | HIPAA | Priority |
|---|---|---|---|---|
| OP-1 | No formal Information Security Policy document | Required (CC1.1) | Required (§164.316) | High — before audit |
| OP-2 | No formal Risk Assessment document | Required (CC3.1) | Required (§164.308(a)(1)) | High — before audit |
| OP-3 | No formal Incident Response Plan (have notes, not a plan) | Required (CC7.4) | Required (§164.308(a)(6)) | High — before audit |
| OP-4 | No formal Business Continuity / Disaster Recovery plan | Required (CC9.1) | Required (§164.308(a)(7)) | Medium |
| OP-5 | No formal Vendor Management / Third-Party Risk program | Required (CC9.2) | Required (§164.308(b)) | Medium |
| OP-6 | No formal Data Retention Policy (have notes, not enforced) | Required (CC6.5) | Required (§164.530(j)) | Medium |
| OP-7 | No formal Employee Security Training program | Required (CC1.4) | Required (§164.308(a)(5)) | Medium |
| OP-8 | No penetration testing or vulnerability scanning | Recommended | Recommended | Low — before production |

---

## SECTION 4: Vendor / BAA / Subprocessor Follow-ups

| ID | Vendor | Relationship | Data Exposure | Status | Action Required |
|---|---|---|---|---|---|
| V-1 | **Lovable AI Gateway** | AI subprocessor | L4 PHI (OCR images, document text, medical narratives) | ❌ No BAA | **Execute BAA immediately before production PHI** |
| V-2 | **Google (Gemini 2.5 Flash)** | Upstream model provider via Lovable | L4 PHI (same as above, proxied through gateway) | ❌ Unknown if Lovable's BAA covers upstream | Confirm coverage in Lovable BAA or obtain separate agreement |
| V-3 | **Supabase (Lovable Cloud)** | Infrastructure provider | L4 PHI (database, storage, backups) | ⚠️ Assumed covered by Lovable Cloud | Confirm BAA coverage for database and storage tiers |
| V-4 | **CDN/Edge hosting** | Request routing | L0 (static assets only) | ✅ No PHI | No action needed |

---

## SECTION 5: AI/LLM Boundary Follow-ups

### Current AI Data Paths

| Path | Function | Data Level | BAA Required | Minimum Necessary | Status |
|---|---|---|---|---|---|
| `process-document` | OCR extraction | L4 | ✅ Yes | ❌ No (full images) | Unavoidable — document as accepted |
| `classify-document` | Document type + metadata | L4 | ✅ Yes | ⚠️ Partial (8K chars, PII not stripped) | **Strip SSN/phone/email patterns before sending** |
| `normalize-entities` | Entity clustering | L3 | ✅ Yes | ✅ Yes (structured values only) | Good — lowest exposure path |
| `generate-chronology` | Timeline extraction | L4 | ✅ Yes | ❌ No (20K chars medical text) | Unavoidable — document as accepted |

### AI Boundary Controls in Place

- ✅ `AI_BOUNDARY_CONFIG` in `src/lib/ai-boundary.ts` — config-driven approval registry
- ✅ `isAIPathApproved()` function for runtime checking
- ✅ Compliance comments in all four edge functions
- ✅ Log sanitization — no raw PHI in edge function console output

### AI Boundary Gaps

| ID | Gap | Severity |
|---|---|---|
| AI-B1 | `classify-document` does not pre-strip PII patterns from text before AI call | Medium |
| AI-B2 | No runtime enforcement of `AI_BOUNDARY_CONFIG` in edge functions (config is documentation-only) | Low — acceptable for current stage |
| AI-B3 | No de-identification preprocessor exists for any path | Low — future enhancement |
| AI-B4 | AI gateway response caching/logging unknown | Medium — requires vendor confirmation |

---

## Validation Summary

| Area | Validated | Status |
|---|---|---|
| Data classification exists and is consistent | ✅ `compliance.ts` inventory, `data-classification.md`, `data-handling-matrix.md` all align | **Pass** |
| Sensitive data boundaries documented | ✅ `data-flow-inventory.md`, `ai-data-boundary.md`, `subprocessor-boundaries.md` | **Pass** |
| Tenant isolation reviewed | ✅ 30+ tables verified with RLS in `tenant-isolation-review.md`. All use `get_user_tenant_id()` | **Pass** |
| Secrets and document access documented | ✅ `secrets-and-key-management.md`, signed URL TTLs reduced, access patterns documented | **Pass** |
| PHI/PII logging exposure reduced | ✅ Edge functions sanitized, `sanitizeForLog` utility, `phi-utils.ts` masking helpers | **Pass** |
| Non-production safeguards exist | ✅ Synthetic-only mock data, compliance guardrail comments, `validateNonProductionZone()` | **Pass** |
| Audit event coverage improved | ✅ 15 action types implemented, `signed_url_generated` now emitted, catalog documented | **Pass with gaps** (auth events, case creation missing) |
| Retention/deletion documented | ✅ `retention-and-deletion.md` with 8 implementation gaps identified | **Pass** (documented but not enforced) |
| AI/model boundary risks identified | ✅ All 4 paths documented, `AI_BOUNDARY_CONFIG` created, BAA requirement flagged | **Pass** |

---

## Final Recommendation

### ReviewerIQ Foundation: **PROCEED NOW**

The architecture is sound for continued development. The two blockers (H-B1: BAA with AI gateway, H-B2: AI data retention confirmation) are **contractual obligations, not code defects**. They must be resolved before production PHI enters the system, but they do not affect:

- Module architecture decisions
- UI/UX development
- Database schema design
- Integration patterns

**Recommended sequencing:**

1. ✅ **Now**: Proceed with ReviewerIQ foundation build using synthetic data
2. **Next sprint**: Add auth event auditing (S2-M1) and case creation auditing (S2-M2)
3. **Before production PHI**: Execute BAA with Lovable (H-B1), confirm AI gateway retention (H-B2)
4. **Before SOC 2 engagement**: Complete formal policy documents (OP-1 through OP-7)
