# CasualtyIQ — Control Gap Register

> **Status**: Readiness hardening baseline. Gaps listed here are known architectural items to address before pursuing formal certification.

## Gap Register

| ID | Category | Gap Description | Severity | Current Mitigation | Recommended Action |
|---|---|---|---|---|---|
| GAP-001 | Encryption | No field-level encryption for PHI at rest. Relies on infrastructure-level disk encryption. | Medium | Supabase-managed infrastructure encryption. RLS prevents unauthorized access. | Evaluate pgcrypto for sensitive columns (extracted_text, fact_text) if required by BAA terms. |
| GAP-002 | Subprocessor | No BAA in place with Lovable Cloud, AI Gateway, or upstream AI providers. | High | Data is transmitted over TLS. AI gateway is Lovable-operated. | Obtain BAA from Lovable. Confirm Google/OpenAI BAA coverage via gateway agreement. |
| GAP-003 | Logging | Edge function console.log may emit classification results containing document snippets. | Medium | Logs are within Lovable Cloud boundary. Not externally accessible. | Sanitize AI response logging to summary metrics only (line 449 in process-document). |
| GAP-004 | Retention | No automated data retention or purge policy. Data persists indefinitely. | Medium | Manual deletion possible. RLS prevents unauthorized access. | Implement retention policy configuration per tenant. Add scheduled purge for expired data. |
| GAP-005 | Access Logging | No login/logout audit trail. Auth events are handled by Supabase Auth internally. | Low | Supabase Auth logs exist at infrastructure level. | Surface auth events into `audit_events` table for tenant-visible audit trail. |
| GAP-006 | Backup/Recovery | No application-level backup verification. Relies on Supabase infrastructure backups. | Medium | Supabase provides automatic backups. | Document backup RPO/RTO. Add backup verification procedure. |
| GAP-007 | Session Management | No configurable session timeout. Uses Supabase Auth defaults. | Low | Supabase Auth handles token refresh. Signed URLs expire at 600s. | Configure session lifetime in Supabase Auth settings per compliance requirements. |
| GAP-008 | Error Messages | Job error messages (`intake_jobs.error_message`) may contain file names or partial content references. | Low | Error messages are tenant-scoped by RLS. | Sanitize error messages to exclude file content. Use error codes + separate detail lookup. |
| GAP-009 | Seed Data | Mock data in `src/data/mock/` uses fictional names but is co-located with production code. | Low | Mock data is client-side only, not inserted into production DB. | Add runtime guard preventing mock data insertion in production environments. |
| GAP-010 | MFA | No multi-factor authentication available for admin accounts. | Medium | Email verification required. Role-based access via `user_roles`. | Enable MFA via Supabase Auth for admin role users. |
| GAP-011 | Export Controls | No controls on data export. Users can view and copy PHI from the browser. | Low | Standard for SaaS applications. Access is role-gated. | Add export audit logging. Consider watermarking for generated artifacts. |
| GAP-012 | AI Data Residency | No guarantee that AI-processed data is not retained by upstream model providers. | Medium | Lovable AI Gateway acts as proxy. | Confirm data retention policies of gateway and upstream providers. Document in subprocessor agreements. |

## Severity Definitions

| Severity | Definition |
|---|---|
| **High** | Must be addressed before handling production PHI. Blocks HIPAA-safe operation. |
| **Medium** | Should be addressed for SOC 2 readiness. Represents meaningful risk. |
| **Low** | Best practice improvement. Not blocking but recommended. |

## Review Cadence

This register should be reviewed:
- Before each major module launch (ReviewerIQ, NarrativeIQ, etc.)
- Quarterly during active development
- Before any formal audit engagement
