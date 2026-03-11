# CasualtyIQ — Change Management Notes

> **Status**: Developer-facing reference for security-sensitive changes. Not a formal change management policy.

## 1. What Constitutes a Security-Sensitive Change

Any change that modifies:

- **Database schema** — especially RLS policies, new tables with PII/PHI, column additions to sensitive tables
- **Edge functions** — especially those with service-role access or AI data flows
- **Authentication/authorization** — role definitions, signup flow, session handling
- **Storage policies** — bucket permissions, signed URL TTLs
- **Environment variables / secrets** — adding, rotating, or removing secrets
- **AI boundary configuration** — changing what data is sent to external models
- **Audit logging** — adding, removing, or modifying audit event capture
- **Data retention** — any change to deletion, archival, or backup behavior

## 2. Evidence-Worthy Events

These changes should be documented with enough context for future audit evidence:

| Change Type | Evidence Artifacts | Where to Document |
|---|---|---|
| Database migration | SQL migration file in `supabase/migrations/` | Migration file + PR description |
| RLS policy change | Migration SQL + before/after policy text | Migration file comments |
| Edge function change | Code diff + deployment log | PR description + commit message |
| Secret rotation | Timestamp of rotation (NOT the secret value) | Incident log or ops channel |
| Auth config change | Before/after settings | PR description |
| Storage policy change | Migration SQL | Migration file |
| AI boundary change | Updated `src/lib/ai-boundary.ts` | PR description |
| Role/permission change | Migration SQL or code diff | Migration file + PR description |

## 3. Security-Sensitive Change Checklist

Use this checklist when making any change from §1:

```markdown
## Security-Sensitive Change Checklist

- [ ] **Describe the change**: What is being modified and why?
- [ ] **Data classification impact**: Does this change how L3/L4 data is stored, transmitted, or accessed?
- [ ] **RLS review**: Are RLS policies still correct after this change?
- [ ] **Audit coverage**: Does this change require new audit events?
- [ ] **AI boundary**: Does this change modify what data is sent to external AI models?
- [ ] **Secrets**: Are any new secrets required? Are existing secrets still valid?
- [ ] **Tenant isolation**: Does this change affect tenant data isolation?
- [ ] **Logging**: Does this change introduce logging that might capture PII/PHI?
- [ ] **Rollback**: Can this change be safely rolled back?
- [ ] **Documentation**: Have compliance docs been updated if needed?
```

## 4. Migration Hygiene

- All schema changes go through `supabase/migrations/` — never manual DDL
- Migration files should include comments explaining security intent:
  ```sql
  -- COMPLIANCE: Adding tenant_id column with RLS enforcement
  -- This table contains L3 PII (claimant identifiers)
  ```
- RLS policy changes should document the before state and reasoning
- Destructive changes (DROP, column removal) require data impact assessment

## 5. Edge Function Deployment

Edge functions are auto-deployed on code push. Security-relevant considerations:

- Functions using `SUPABASE_SERVICE_ROLE_KEY` bypass RLS — document why
- Functions calling AI gateway transmit PHI — see `docs/compliance/ai-data-boundary.md`
- Changes to function auth (`verify_jwt` in config.toml) are security-sensitive
- New functions should be added to the AI boundary config if they call external services

## 6. Current Gaps

| Gap | Description | Priority |
|---|---|---|
| CM-001 | No formal change approval workflow | Medium — use PR reviews as proxy |
| CM-002 | No automated change detection/alerting for security-sensitive files | Low |
| CM-003 | No change log separate from git history | Low — git log is sufficient for now |
| CM-004 | Secret rotation not logged to audit_events | Medium |
