# CasualtyIQ — Encryption Posture

> **Status**: Readiness hardening baseline. Encryption controls documented here reflect the hosting platform's capabilities. No independent attestation has been performed.

## 1. Encryption in Transit

| Path | Protocol | Status |
|---|---|---|
| Browser ↔ Supabase API | HTTPS / TLS 1.2+ | ✅ Enforced by platform |
| Browser ↔ Storage (signed URLs) | HTTPS / TLS 1.2+ | ✅ Enforced by platform |
| Edge Functions ↔ Supabase DB | Internal TLS | ✅ Managed by platform |
| Edge Functions ↔ AI Gateway | HTTPS / TLS 1.2+ | ✅ Enforced by application code |
| AI Gateway ↔ Upstream Models | HTTPS / TLS 1.2+ | ✅ Assumed (Lovable-operated) |

**No unencrypted channels exist in the architecture.**

## 2. Encryption at Rest

| Asset | Encryption | Provider | Notes |
|---|---|---|---|
| Postgres database | AES-256 disk encryption | Supabase / AWS infrastructure | Platform-managed; no application-level key management |
| Storage buckets (`case-documents`, `derived-artifacts`) | AES-256 disk encryption | Supabase / AWS S3 | Server-side encryption (SSE-S3 or SSE-KMS depending on platform tier) |
| Database backups | Encrypted at rest | Supabase / AWS infrastructure | Same encryption as primary storage |
| Edge function environment | Ephemeral; secrets encrypted at rest | Lovable Cloud | Secrets injected at invocation time |

### Gaps and Assumptions

| Gap | Description | Risk | Recommendation |
|---|---|---|---|
| No field-level encryption | PHI stored as plaintext in encrypted-at-rest database columns | Medium | Evaluate `pgcrypto` for `extracted_text`, `fact_text` columns if BAA requires application-layer encryption |
| No client-managed keys (CMK) | Encryption keys managed entirely by platform provider | Low | Standard for managed SaaS; CMK available on enterprise Supabase tiers |
| No envelope encryption for storage | Files encrypted by platform S3, not by application | Low | Application-level encryption would add complexity; evaluate if required by BAA |
| Backup encryption verification | Cannot independently verify backup encryption | Low | Document as platform dependency; request attestation from provider |

## 3. Key Management

See [secrets-and-key-management.md](./secrets-and-key-management.md) for the full secret inventory.

**Application does not manage its own encryption keys.** All encryption key management is delegated to the hosting platform (Supabase / AWS KMS).

## 4. Data Destruction

| Scenario | Method | Completeness |
|---|---|---|
| Document deletion | Supabase Storage API `remove()` + DB record delete | Logical deletion; physical deletion depends on platform garbage collection |
| Case deletion | Not implemented | ⚠️ Gap — no cascade delete mechanism exists |
| Tenant offboarding | Not implemented | ⚠️ Gap — no tenant data purge mechanism exists |
| Backup retention | Platform-managed | Backup retention period determined by Supabase tier |

**Recommendation**: Implement a tenant data purge function for offboarding, and document the platform's backup retention window.
