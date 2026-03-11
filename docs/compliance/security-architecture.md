# CasualtyIQ — Security Architecture Overview

> **Status**: Readiness hardening baseline. This document describes the current system architecture from a security perspective. It does **NOT** constitute a claim of SOC 2 Type II certification or HIPAA compliance. It exists to support future audit, policy, and evidence work.

## 1. System Boundary

CasualtyIQ is a multi-tenant SaaS platform for personal injury case management, document intake, and demand-letter preparation. The system boundary includes:

| Component | Hosting | Trust Level |
|---|---|---|
| React SPA (browser client) | CDN / Lovable preview | User-controlled environment |
| Supabase Postgres DB | Lovable Cloud (managed) | Primary data store — **trusted** |
| Supabase Auth | Lovable Cloud (managed) | Identity provider — **trusted** |
| Supabase Storage (buckets) | Lovable Cloud (managed) | File store — **trusted** |
| Edge Functions (Deno) | Lovable Cloud (managed) | Server-side compute — **trusted** |
| Lovable AI Gateway | Lovable-operated proxy | Third-party AI inference — **semi-trusted** |
| Upstream AI Models | Google (Gemini), OpenAI | External subprocessor — **external trust** |

## 2. Authentication & Authorization

- **Authentication**: Supabase Auth (email/password, email verification required).
- **Authorization**: Row-Level Security (RLS) on every table. All data access is scoped to `tenant_id` via `get_user_tenant_id(auth.uid())`.
- **Roles**: Stored in `user_roles` table (not in profiles). Checked via `has_role()` SECURITY DEFINER function.
- **Service Role Key**: Used only in edge functions (server-side). Never exposed to the client.

## 3. Network Trust Boundaries

```
┌─────────────────────────────────────────────────────┐
│  BROWSER (untrusted)                                │
│  - React SPA                                        │
│  - Supabase anon key (publishable)                  │
│  - No secrets, no service role access               │
└──────────────┬──────────────────────────────────────┘
               │ HTTPS (TLS 1.2+)
┌──────────────▼──────────────────────────────────────┐
│  LOVABLE CLOUD — PRIMARY TRUST BOUNDARY             │
│  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ Supabase Auth     │  │ Supabase Postgres (RLS)  │ │
│  └──────────────────┘  └──────────────────────────┘ │
│  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ Storage Buckets   │  │ Edge Functions (Deno)    │ │
│  │ (case-documents,  │  │ (process-document,       │ │
│  │  derived-artifacts)│  │  classify-document,     │ │
│  └──────────────────┘  │  normalize-entities,     │ │
│                        │  generate-chronology)    │ │
│                        └──────────┬───────────────┘ │
└─────────────────────────────────┬─┘                 │
                                  │                   │
               ┌──────────────────▼───────────────────┘
               │ HTTPS (TLS 1.2+)
┌──────────────▼──────────────────────────────────────┐
│  EXTERNAL TRUST BOUNDARY                            │
│  - Lovable AI Gateway (ai.gateway.lovable.dev)      │
│  - Upstream models: Google Gemini, OpenAI            │
│  - Data sent: document text, OCR images (base64)    │
│  - Data returned: structured extractions, text      │
└─────────────────────────────────────────────────────┘
```

## 4. Data at Rest

- **Database**: Supabase-managed Postgres. Encryption at rest is provided by the infrastructure layer.
- **Storage buckets**: Private (not public). Accessed via signed URLs with 600s expiry (auto-refreshed in the review workspace).
- **No client-side persistence** of PHI/PII beyond the browser session (no localStorage of case data).

## 5. Data in Transit

- All client ↔ server communication uses HTTPS/TLS.
- Edge function ↔ AI gateway communication uses HTTPS/TLS.
- Signed URLs for storage objects use HTTPS.

## 6. Secrets Management

| Secret | Location | Purpose |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge function env | Full DB access (server-side only) |
| `LOVABLE_API_KEY` | Edge function env | AI gateway authentication |
| `SUPABASE_URL` | Edge function env + client `.env` | API endpoint |
| `SUPABASE_ANON_KEY` | Client `.env` (publishable) | Client-side auth |

- Private keys never appear in client-side code.
- `.env` is auto-managed and gitignored.

## 7. Multi-Tenancy Isolation

- Every data table includes a `tenant_id` column.
- RLS policies enforce `tenant_id = get_user_tenant_id(auth.uid())` on all operations.
- Storage paths are scoped by tenant/case: `{tenant_id}/{case_id}/{filename}`.
- Cross-tenant data access is architecturally prevented at the database layer.

## 8. Audit Trail

- `audit_events` table captures user actions with actor, entity, before/after values.
- RLS prevents cross-tenant audit access.
- Audit records are insert-only (no UPDATE/DELETE RLS policies).

## 9. Known Architectural Gaps

See [control-gap-register.md](./control-gap-register.md) for the full gap inventory.

Key items:
- No field-level encryption for PHI at rest (relies on infrastructure-level encryption).
- AI gateway receives document text / images — classified as a subprocessor data flow.
- No automated data retention / purge mechanism.
- Console logging in edge functions may include document IDs and error details.
- No intrusion detection or anomaly monitoring layer.
