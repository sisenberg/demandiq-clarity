# CasualtyIQ — SC-1 to SC-6 Hardening Validation Report

> **Validated**: 2026-03-11
> **Method**: Live repo inspection — docs, code, database schema, RLS policies, edge functions, mock data, readiness report
> **Disclaimer**: This validates architecture artifacts. It is not a penetration test, audit, or certification.

---

## Overall Result: **PASS WITH ISSUES**

All six test areas have substantive artifacts in place. The architecture is materially hardened for continued development with synthetic data. Two issues prevent production PHI use (contractual, not code). Three minor code-level issues were found during validation.

---

## Test 1 — Data Classification and Boundary Docs

**Result: PASS**

| Check | Evidence | Status |
|---|---|---|
| Compliance docs exist | 18 files in `docs/compliance/` | ✅ |
| Data classification levels defined | `data-classification.md` — L0 through L4 with handling rules | ✅ |
| Table-level classification | `compliance.ts` — 30 `DataAssetDescriptor` entries covering all tables and buckets | ✅ |
| Sensitive fields identified per table | `sensitiveFields` arrays in `compliance.ts` + `data-handling-matrix.md` for 14 field types | ✅ |
| Canonical evidence vs derived zone | `subprocessor-boundaries.md` §2 defines Zone 1 (primary evidence), Zone 2 (derived), Zone 3 (config), Zone 4 (non-prod) | ✅ |
| Non-prod boundary documented | `data-handling-matrix.md` marks all fields as 🔴 Synthetic in non-prod column | ✅ |
| Data flow inventory | `data-flow-inventory.md` — inbound, internal, external, client-side, log flows documented | ✅ |

**Issues: None**

---

## Test 2 — Tenant Isolation and Privileged Access

**Result: PASS**

| Check | Evidence | Status |
|---|---|---|
| RLS audit documented | `tenant-isolation-review.md` — 30+ tables reviewed with SELECT/INSERT/UPDATE/DELETE verdicts | ✅ |
| All data tables tenant-scoped | Every table uses `get_user_tenant_id(auth.uid())` in RLS policies (verified against live schema) | ✅ |
| Storage buckets private with RLS | Both `case-documents` and `derived-artifacts` are private, tenant-scoped | ✅ |
| Service-role key server-only | `secrets-and-key-management.md` §2 confirms isolation. Verified: no import of service-role in `src/` | ✅ |
| Edge functions documented as privileged | All 4 edge functions have COMPLIANCE NOTE comments identifying data level and subprocessor flow | ✅ |
| Roles stored in separate table | `user_roles` table, not on profiles. `has_role()` SECURITY DEFINER function. | ✅ |
| Access control model documented | `access-control-model.md` — 5 roles, 13 permissions, client vs server boundary clearly separated | ✅ |

**Issues: None**

---

## Test 3 — Secrets, Signed Access, and Document Security

**Result: PASS**

| Check | Evidence | Status |
|---|---|---|
| Secrets inventory exists | `secrets-and-key-management.md` — 6 server-side secrets, 3 client-side env vars documented | ✅ |
| No private secrets in client code | Verified: `SUPABASE_SERVICE_ROLE_KEY` and `LOVABLE_API_KEY` only referenced in edge functions | ✅ |
| Signed URL TTLs reduced | `DocumentReviewWorkspace`: 300s TTL, 240s refresh. `IntakeDocumentsWorkstation`: 120s TTL | ✅ |
| Signed URL generation audited | `signed_url_generated` audit events emitted in both viewer and view-original paths | ✅ |
| Export path marked sensitive | `ExportsPage.tsx` lines 26-30: COMPLIANCE comment identifying L4 data, filename restrictions | ✅ |
| Encryption posture documented | `encryption-posture.md` — TLS 1.2+ transit, AES-256 at rest (infrastructure), gaps noted | ✅ |

**Issues: None**

---

## Test 4 — PHI/PII Minimization and Logging Hygiene

**Result: PASS WITH ISSUES**

| Check | Evidence | Status |
|---|---|---|
| Data handling matrix exists | `data-handling-matrix.md` — 14 fields × 7 zones with clear symbols | ✅ |
| Masking utilities exist | `phi-utils.ts` — `maskName`, `maskSSN`, `maskPhone`, `maskEmail`, `maskAddress`, `maskIdentifier` | ✅ |
| `sanitizeForLog` utility | `phi-utils.ts` — deep-sanitizes objects against 19 PII field patterns | ✅ |
| Edge function log sanitization | All 4 functions have COMPLIANCE NOTEs. `classify-document` logs document_id only (not text). `normalize-entities` has compliance comment. `generate-chronology` logs case_id only. | ✅ |
| Mock data synthetic-only | `cases.ts` line 4-9: compliance guardrail comment. `index.ts` line 1-6: compliance guardrail. Names verified fictional. | ✅ |
| AI boundary config exists | `ai-boundary.ts` — 4 paths with `approved`, `dataLevel`, `requiresBAA`, `minimumNecessary` flags | ✅ |
| AI boundary doc exists | `ai-data-boundary.md` — path inventory, risk assessment, gap list | ✅ |

### Issues Found

| ID | Severity | Finding |
|---|---|---|
| T4-m1 | **Minor** | `sanitizeForLog` is defined but not actually called in any edge function. Edge functions use manual compliance comments instead of the utility. The utility is client-side only (`src/lib/`), not importable from Deno edge functions. This is architecturally correct (different runtimes) but means edge function logging relies on developer discipline, not programmatic enforcement. |
| T4-m2 | **Minor** | `maskName`/`maskEmail`/etc. utilities exist but are not yet integrated into any UI component. The matrix says admin lists should show masked names, but `CasesPage` and admin views still show full values. This is a UI-level gap, not a data leak (RLS protects access). |
| T4-m3 | **Minor** | `classify-document` line 71 logs `document_id` which is safe. However, no edge function logs `case_id` in a sanitized way — `generate-chronology` line 40 logs raw `case_id`. This is acceptable (UUIDs are pseudonymous) but noted. |

---

## Test 5 — Audit / Retention / Incident Foundations

**Result: PASS**

| Check | Evidence | Status |
|---|---|---|
| Audit event catalog | `audit-event-catalog.md` — 15 implemented action types, 3 pending, 9 recommended | ✅ |
| Security-relevant actions audited | `signed_url_generated`, `role_changed`, `entitlement_changed`, `processing_triggered`, `document_uploaded` all implemented | ✅ |
| Audit events append-only | RLS blocks UPDATE and DELETE on `audit_events` table | ✅ |
| Auth events gap acknowledged | Catalog explicitly lists `login_success`, `login_failed`, `logout` as "Not Yet Defined — Recommended" | ✅ |
| Retention/deletion doc | `retention-and-deletion.md` — 14 data categories with intended retention, 8 gaps identified | ✅ |
| Incident response notes | `incident-response-notes.md` — log sources, component-to-data mapping, triage questions, containment actions, 5 gaps | ✅ |
| Breach assessment notes | `breach-assessment-notes.md` — 4 breach scenarios, triage checklist, evidence preservation guide | ✅ |
| Change management notes | `change-management-notes.md` — security-sensitive change checklist, migration hygiene, 4 gaps | ✅ |
| Backup/recovery doc | `backup-and-recovery.md` — recovery tiers, RPO/RTO assumptions, 8 gaps | ✅ |

**Issues: None**

---

## Test 6 — Readiness Report Quality

**Result: PASS**

| Check | Evidence | Status |
|---|---|---|
| Report exists | `readiness-report-sc1-sc5.md` | ✅ |
| Separates technical controls from policy gaps | Section 1 (SOC 2 architecture), Section 2 (HIPAA architecture), Section 3 (operational/policy gaps) — clearly separated | ✅ |
| Vendor/BAA gaps called out | Section 4 — 4 vendors with BAA status (all ⚠️ or ❌) | ✅ |
| AI/LLM boundary gaps | Section 5 — 4 data paths, 4 boundary gaps identified | ✅ |
| Does not overstate compliance | Line 3: "This is NOT a certification claim. This is a self-assessment." Line 11: "Two blockers prevent production PHI handling today." | ✅ |
| Honest about blockers | H-B1 (no BAA) and H-B2 (AI retention unknown) clearly marked as blockers | ✅ |
| Validation summary table | 9 areas validated with Pass/Pass with gaps | ✅ |

**Issues: None**

---

## Summary of All Findings

### Blockers — 0

No code-level blockers found. The two blockers identified in the readiness report (BAA, AI retention) are contractual and correctly categorized.

### Major — 0

No major issues found during validation.

### Minor — 3

| ID | Area | Issue | Impact | Recommendation |
|---|---|---|---|---|
| T4-m1 | Logging | `sanitizeForLog` not usable in edge functions (different runtime) | Low — edge functions use manual discipline | Consider creating a Deno-compatible version of the sanitizer for edge functions, or accept as documented limitation |
| T4-m2 | UI masking | Masking utilities exist but not integrated into list views | Low — RLS prevents unauthorized access regardless | Integrate `maskName` into admin case lists and user management views in a future UI pass |
| T4-m3 | Edge logging | Edge functions log UUIDs (case_id, document_id) which is acceptable | Negligible — UUIDs are pseudonymous | No action required |

---

## Go / No-Go Recommendation

### ReviewerIQ Foundation: **GO** ✅

The hardening work from SC-1 through SC-6 is substantively complete. Architecture, documentation, and code controls are in place. The three minor issues do not affect security posture or development safety.

### Must-Fix Items Before Real PHI Production Use

| Priority | Item | Owner | Description |
|---|---|---|---|
| **Blocker** | H-B1 | Business/Legal | Execute BAA with Lovable covering AI Gateway + infrastructure |
| **Blocker** | H-B2 | Business/Legal | Obtain written AI gateway data retention policy |
| **High** | S2-M1 | Engineering | Add auth event auditing (login/logout) |
| **High** | S2-M3 | Engineering | Enable MFA for admin role accounts |
| **High** | H-M5 | Engineering | Build document deletion cascade for PHI purge capability |
| **Medium** | H-M2 | Engineering | Add PII pattern stripping to `classify-document` before AI call |
| **Medium** | S2-M4 | Engineering | Configure session timeout |
| **Medium** | OP-1–OP-3 | Business/Legal | Draft formal Information Security Policy, Risk Assessment, Incident Response Plan |
