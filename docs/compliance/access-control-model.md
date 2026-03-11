# CasualtyIQ — Access Control Model

> **Status**: Readiness hardening baseline. Not a certification claim.

## 1. Role Hierarchy

| Role | Scope | Purpose |
|---|---|---|
| `admin` | Tenant | Full tenant management: users, config, entitlements, audit export |
| `manager` | Tenant | Case oversight: assignment, processing triggers, all-case visibility |
| `reviewer` | Tenant | Data validation: extraction review, entity correction |
| `adjuster` | Tenant | Case creation, document upload, case editing |
| `readonly` | Tenant | View assigned cases only |

### Operational Mapping

| Capability | admin | manager | reviewer | adjuster | readonly |
|---|---|---|---|---|---|
| Create case | ✅ | ✅ | ❌ | ✅ | ❌ |
| Upload document | ✅ | ✅ | ❌ | ✅ | ❌ |
| Trigger processing | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit extraction | ✅ | ✅ | ✅ | ❌ | ❌ |
| Complete module | ✅ | ✅ | ❌ | ❌ | ❌ |
| Download artifacts | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ | ❌ |
| View audit log | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign case | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit case | ✅ | ✅ | ❌ | ✅ | ❌ |
| View all cases | ✅ | ✅ | ✅ | ❌ | ❌ |
| View admin panel | ✅ | ❌ | ❌ | ❌ | ❌ |

## 2. Authorization Architecture

### Client-Side (UI Gating)

- **`useAuth()` context** provides `role`, `tenantId`, `user`, `tenantModules`.
- **`hasPermission(role, permission)`** in `src/lib/permissions.ts` gates UI elements.
- **`<RoleGuard>`** component wraps routes requiring specific permissions.
- **`<ModuleGuard>`** component wraps routes requiring module entitlements.
- **`<ProtectedRoute>`** wraps all authenticated routes.

Client-side checks are for UX only — they are NOT security boundaries.

### Server-Side (Security Boundary)

- **Row-Level Security (RLS)** on every data table enforces `tenant_id = get_user_tenant_id(auth.uid())`.
- **Storage policies** enforce tenant-scoped paths via `(storage.foldername(name))[1] = tenant_id`.
- **`has_role()` SECURITY DEFINER function** for role checks without RLS recursion.
- **`get_user_tenant_id()` SECURITY DEFINER function** for tenant resolution.
- **Service role key** used only in edge functions (server-side Deno runtime).

### Edge Functions (Privileged Access)

All edge functions use the service role key. They are server-to-server only.

| Function | Why Privileged | Tenant Validation |
|---|---|---|
| `process-document` | Reads storage, writes pages/extractions | Via job → document → tenant_id chain |
| `classify-document` | Reads extracted text, writes classifications | Via document_id lookup |
| `normalize-entities` | Reads all extractions for a case | Via case_id lookup |
| `generate-chronology` | Reads all extracted text for a case | Via case_id lookup |

## 3. Tenant Isolation

### Database Layer
- Every data table has `tenant_id` column with RLS policy.
- RLS uses `get_user_tenant_id(auth.uid())` — a SECURITY DEFINER function.
- Cross-tenant queries are architecturally impossible via the client SDK.
- `user_roles` table stores roles separately from `profiles` (prevents privilege escalation).

### Storage Layer
- Storage paths follow `{tenant_id}/{case_id}/{filename}` convention.
- Storage RLS policies validate `(storage.foldername(name))[1] = tenant_id`.
- Signed URLs expire after 600s with auto-refresh in the review workspace.

### Edge Functions
- Use service role key (bypasses RLS) — must self-validate tenant ownership.
- All functions trace back to a tenant-scoped entity (job, document, or case).

## 4. Security-Sensitive Actions Inventory

These actions are tracked or should be tracked in the audit system:

| Action | Current Tracking | Audit Action Type |
|---|---|---|
| Document upload | ❌ Not tracked | `document_uploaded` |
| Document download/view (signed URL) | ❌ Not tracked | `document_accessed` |
| Signed URL generation | ❌ Not tracked | `signed_url_generated` |
| Manual metadata correction | ✅ Tracked | `metadata_corrected` |
| Document type acceptance | ✅ Tracked | `document_type_changed` |
| Chronology edit | ✅ Tracked | `chronology_edited` |
| Chronology status change | ✅ Tracked | `chronology_status_changed` |
| Entity rename/merge | ✅ Tracked | `entity_renamed` / `entity_merged` |
| Export generation | ❌ Not tracked | `artifact_exported` |
| Admin role change | ❌ Server-side only | `role_changed` |
| Module entitlement change | ❌ Not tracked | `entitlement_changed` |
| Processing trigger/retry | ❌ Not tracked | `processing_triggered` |

## 5. Future: SSO/MFA Readiness

The auth architecture is centralized through `AuthContext` and `supabase.auth`, making it ready for:

- **SSO (SAML/OIDC)**: Supabase Auth supports enterprise SSO. No app code changes needed — configure at the auth provider level.
- **MFA (TOTP)**: Supabase Auth supports MFA enrollment. Would require UI for enrollment flow + `supabase.auth.mfa.*` API calls.
- **Session policies**: Configurable via Supabase Auth settings (session lifetime, refresh behavior).

Current gap: No MFA enforcement for admin accounts (see GAP-010 in control-gap-register.md).

## 6. Signed URL Security

| Pattern | Current | Hardened |
|---|---|---|
| Document viewer URLs | 600s expiry, auto-refresh at 480s | ✅ Adequate |
| Download URLs | Generated on-demand | Should be shortest practical TTL |
| Artifact URLs | Generated on-demand | Should be shortest practical TTL |

Signed URLs are scoped by storage RLS — a user can only generate URLs for objects in their tenant folder.
