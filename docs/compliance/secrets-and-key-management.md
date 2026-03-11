# CasualtyIQ — Secrets & Key Management

> **Status**: Readiness hardening baseline. Not a certification claim.

## 1. Secret Inventory

### Edge Function Secrets (Server-Side Only)

| Secret | Purpose | Owner | Rotation | Scope | Client Exposure |
|---|---|---|---|---|---|
| `SUPABASE_URL` | Database/API endpoint | Platform (auto-provisioned) | N/A (stable) | All edge functions | ❌ Never client-side as secret; mirrored as `VITE_SUPABASE_URL` (public endpoint) |
| `SUPABASE_SERVICE_ROLE_KEY` | Full database access bypassing RLS | Platform (auto-provisioned) | On compromise | All edge functions | ❌ **NEVER** exposed to client |
| `SUPABASE_ANON_KEY` | Publishable client auth key | Platform (auto-provisioned) | On compromise | Auto-generated `.env` | ✅ Intentionally public (publishable) |
| `LOVABLE_API_KEY` | AI gateway authentication for OCR, classification, entity normalization, chronology | Platform (Lovable-issued) | On compromise or rotation policy | All 4 edge functions | ❌ **NEVER** exposed to client |
| `SUPABASE_DB_URL` | Direct Postgres connection string | Platform (auto-provisioned) | On compromise | Available but unused by app code | ❌ **NEVER** exposed to client |
| `SUPABASE_PUBLISHABLE_KEY` | Alias for anon key | Platform (auto-provisioned) | On compromise | Auto-generated `.env` | ✅ Intentionally public |

### Client-Side Environment Variables

| Variable | Value Type | Sensitive? | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Public API endpoint URL | No | Safe to expose — it's the public API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable anon key | No | Designed for client-side use; RLS enforces access |
| `VITE_SUPABASE_PROJECT_ID` | Project identifier | No | Used to construct function invocation URLs |

### Optional/Future Secrets

| Secret | Purpose | Status |
|---|---|---|
| `OCR_PROVIDER` | External OCR provider selector | Not set (defaults to Lovable AI) |
| `OCR_PROVIDER_API_KEY` | External OCR provider auth | Not configured |

## 2. Security Properties

### Service Role Key Isolation

The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS policies. It is:
- Available **only** in the Deno edge function runtime
- **Never** imported, referenced, or bundled in client-side code
- **Never** stored in `localStorage`, `sessionStorage`, or cookies
- Used by: `process-document`, `classify-document`, `normalize-entities`, `generate-chronology`

### Client SDK Authentication

The client uses `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key) which:
- Authenticates via Supabase Auth (JWT)
- All data access is mediated by RLS policies
- Cannot bypass row-level security
- Cannot access other tenants' data

## 3. Rotation Expectations

| Secret | Rotation Trigger | Rotation Method |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Suspected compromise | Regenerate in Lovable Cloud; auto-propagates to edge functions |
| `LOVABLE_API_KEY` | Suspected compromise or scheduled rotation | Update via Lovable Cloud secrets management |
| `SUPABASE_ANON_KEY` | Suspected compromise | Regenerate; update client `.env` (auto-managed) |

**Current gap**: No automated rotation schedule exists. Rotation is manual and reactive.

## 4. Secret Storage

- **Edge function secrets**: Stored in Lovable Cloud's encrypted secrets store. Injected as environment variables at function invocation time.
- **Client `.env`**: Auto-generated and gitignored. Contains only publishable keys.
- **No `.env.local`** or manual environment files.
- **No hardcoded secrets** in source code (verified by search).

## 5. Verified: No Client-Side Secret Leaks

Audit of all `import.meta.env` references in client code:
- `VITE_SUPABASE_URL` — public API endpoint ✅
- `VITE_SUPABASE_PUBLISHABLE_KEY` — publishable anon key ✅
- `VITE_SUPABASE_PROJECT_ID` — public project identifier ✅

No service role key, no `LOVABLE_API_KEY`, no database connection strings appear in client code.
