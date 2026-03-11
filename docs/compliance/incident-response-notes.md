# CasualtyIQ — Incident Response Notes

> **Status**: Developer-facing reference for incident triage. Not a formal incident response plan.

## 1. Log Sources

| Source | What It Contains | Access Method | Retention |
|---|---|---|---|
| **Edge function logs** | Function invocations, errors, timing | Lovable Cloud → Edge Function Logs | Platform-managed (days) |
| **Audit events table** | User actions, entity changes, before/after values | `SELECT * FROM audit_events` | No automated deletion |
| **Supabase Auth logs** | Login attempts, token refreshes, auth errors | Lovable Cloud backend view | Platform-managed |
| **Storage access logs** | Not available | N/A | ❌ Gap — no storage access logging |
| **Client console** | Browser-side errors, warnings | User's browser DevTools | Not persisted |
| **Git history** | Code changes, deployments | Git log | Permanent |

## 2. Component → Data Class Mapping

If a component is compromised, these data classes could be affected:

| Component | Data Classes at Risk | Blast Radius |
|---|---|---|
| **Supabase database** | L4 PHI (extracted_text, fact_text), L3 PII (names, identifiers), L2 internal | All tenants (if service-role compromised); single tenant (if user JWT compromised) |
| **Storage: case-documents** | L4 PHI (raw medical records, legal documents) | Tenant-scoped via RLS; all tenants if service-role compromised |
| **Storage: derived-artifacts** | L3-L4 (generated reports containing assembled PHI/PII) | Same as above |
| **Edge functions** | L4 PHI in transit to AI gateway | Single invocation scope; no persistent state |
| **AI Gateway (Lovable)** | L4 PHI (document text, images sent for OCR/classification) | Depends on gateway's own data retention |
| **Client browser** | L4 PHI (displayed document text, signed URLs in memory) | Single user session |
| **Auth system** | L1 (email, display name) | Single user or tenant |

## 3. Immediate Triage Questions

### For any suspected incident:

1. **What component is affected?** (database, storage, edge function, client, auth)
2. **Is it a single tenant or cross-tenant?** Check if service-role key was involved
3. **What data classes are exposed?** Use the table above
4. **Is the exposure ongoing?** Can we revoke access (rotate keys, disable function)?
5. **How many records/users are affected?** Query audit_events for scope
6. **Is PHI involved?** If yes, triggers HIPAA breach assessment (see breach-assessment-notes.md)

### For suspected unauthorized access:

1. Check `audit_events` for unexpected `actor_user_id` values
2. Check edge function logs for unusual invocation patterns
3. Check auth logs for failed login attempts or unusual IP addresses
4. Review `signed_url_generated` audit events for unusual patterns

### For suspected data exposure:

1. Identify the data class (L0-L4) using `src/lib/compliance.ts` inventory
2. Check if data left the primary trust boundary (sent to AI, exported, logged)
3. Review edge function logs for PHI in log output (should be redacted)
4. Check if signed URLs were generated with unusual TTLs

## 4. Evidence Sources for Investigation

| Evidence Type | Source | Query Example |
|---|---|---|
| User actions | `audit_events` | `SELECT * FROM audit_events WHERE actor_user_id = '...' ORDER BY created_at DESC` |
| Document access | `audit_events` WHERE action_type = `signed_url_generated` | Filter by entity_id (document UUID) |
| Admin changes | `audit_events` WHERE action_type IN (`role_changed`, `entitlement_changed`) | Filter by tenant_id |
| Processing history | `intake_jobs` | `SELECT * FROM intake_jobs WHERE case_id = '...' ORDER BY created_at` |
| Data modifications | `audit_events` with before_value/after_value | Compare snapshots |
| Code changes | Git log | `git log --since="2024-01-01" -- supabase/functions/` |

## 5. Containment Actions

| Scenario | Immediate Action |
|---|---|
| Service-role key compromised | Rotate key in Lovable Cloud immediately |
| User account compromised | Disable user in auth system; review their audit trail |
| Edge function vulnerability | Remove/disable function deployment; review logs |
| Storage bucket exposure | Verify RLS policies; rotate signed URLs (short TTLs help) |
| AI gateway data leak | Contact Lovable support; review what data was sent |

## 6. Current Gaps

| Gap | Description | Impact |
|---|---|---|
| IR-001 | No storage access logging | Cannot audit who accessed raw files outside signed URLs |
| IR-002 | No automated alerting on suspicious patterns | Must manually review logs |
| IR-003 | No client-side error reporting/telemetry | Browser-side incidents invisible |
| IR-004 | No IP/user-agent capture in audit events | Cannot correlate to network-level evidence |
| IR-005 | No formal escalation contacts or runbook | Incident handling is ad-hoc |
