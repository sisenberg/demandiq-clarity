

## Plan: Wire EvaluateIQ Initialization to Real DemandPackage Data

### Root Cause

`useEvaluateIntakeSnapshot` calls `useCasePackage()`, which **always returns hardcoded mock data** (`MARTINEZ_CASE_PACKAGE`). The real published DemandPackage from the database is never used to build the intake snapshot. This means every EvaluateIQ session sees the same fake data regardless of the actual case.

### Changes

#### 1. New adapter: `src/lib/demandPackageIntakeAdapter.ts`

Converts a `DemandPackageV1` (the real DB-backed published package) into an `EvaluateIntakeSnapshot`. Maps:
- `case_header` → claimant identity, accident facts, venue
- `damages_seeds.injury_summary` → injuries array with provenance
- `damages_seeds.treatment_summary` → treatment timeline entries
- `damages_seeds.specials_summary` → medical billing entries
- `damages_seeds.provider_list` → providers
- `clinical_indicators` → clinical flags
- `case_header.demand_amount` / policy limits → policy coverage
- `review_needed_flags` → upstream concerns
- `completeness.missing_data_flags` → completeness warnings

All fields get `FieldProvenance` with `source_module: "demandiq"` and `source_package_version` from the package.

#### 2. Rewrite `src/hooks/useEvaluateIntakeSnapshot.ts`

Replace the mock-based builder with:
- Fetch the published DemandPackage via `useDemandPackagePublished(caseId)`
- When available, call `buildIntakeFromDemandPackage(pkg)` from the new adapter
- Remove dependency on `useCasePackage()` entirely
- Keep eligibility gating — only build snapshot when eligible

#### 3. No other files change

The downstream chain (`useValuationInput` → `hydrateFromIntake` → workspace) already consumes `EvaluateIntakeSnapshot` correctly. The `useEvaluateEligibility` and `useStartEvaluate` hooks already gate on real published packages. Only the snapshot source needs repair.

### Files

| File | Action |
|------|--------|
| `src/lib/demandPackageIntakeAdapter.ts` | Create — DemandPackageV1 → EvaluateIntakeSnapshot mapper |
| `src/hooks/useEvaluateIntakeSnapshot.ts` | Rewrite — use real DemandPackage instead of mock CasePackage |

