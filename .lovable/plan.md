

## Plan: End-to-End Vertical Slice — Upload to EvaluateIQ Launch

### Diagnosis

The pipeline pieces all exist but there are **5 specific breaks** preventing the vertical slice from working:

#### Bug 1: Missing `config.toml` entries
`process-document`, `classify-document`, and `normalize-entities` are NOT listed in `supabase/config.toml` with `verify_jwt = false`. When called server-to-server with the service role key, they may fail JWT validation depending on the default setting.

#### Bug 2: `extract-demand` job status race condition
The orchestrator sets the job to `status: "running"` (line 110), but `extract-demand` tries to mark it `"completed"` with `.eq("status", "queued")` (line 212). This filter never matches, so the job stays in `"running"` forever. The `maybeAutoAssemblePackage` check then sees pending jobs and never assembles the package.

#### Bug 3: Auto-assemble produces `draft`/`ready_for_review` — not `published`
`maybeAutoAssemblePackage` calls `publish-intake-package` with `action: "assemble"`, which creates a package with status `draft` or `ready_for_review`. EvaluateIQ launch requires `published_to_evaluateiq`. The user must manually publish, but there's no clear "auto-publish when ready" path for a single-demand flow.

#### Bug 4: Route nesting error in `App.tsx`
The `/admin/benchmarks` route is placed outside the `<ProtectedRoute>` wrapper (after the closing `</Route>` on line 138), meaning it renders without the main layout or auth protection.

#### Bug 5: No auto-publish for first-demand cases
For the vertical slice, when a single demand produces all required fields, the package should auto-publish (or the publish button should be prominent and accessible from the intake review workspace).

### Changes

#### 1. Fix `config.toml` — add missing function entries
Add `process-document`, `classify-document`, and `normalize-entities` with `verify_jwt = false`.

#### 2. Fix `extract-demand` job status update
Change the status filter from `.eq("status", "queued")` to `.in("status", ["queued", "running"])` so the completed status is properly recorded regardless of whether the orchestrator already set it to running.

#### 3. Fix `App.tsx` route nesting
Move the `/admin/benchmarks` route inside the protected `<MainLayout>` wrapper where it belongs.

#### 4. Add auto-publish logic to `orchestrate-intake`
After `maybeAutoAssemblePackage` runs, if the assembled package has status `ready_for_review` (meaning no critical missing data), auto-publish it by calling `publish-intake-package` with `action: "publish"`. This completes the vertical slice: upload → extract → assemble → publish → EvaluateIQ eligible.

#### 5. Enhance `IntakeEvaluatePublishPanel` with status polling
Add `refetchInterval` to the package query so the UI updates automatically when the auto-publish completes, rather than requiring a manual refresh.

#### 6. Enhance `CaseOverview` — show extraction status + launch path
Surface the pipeline status in the overview: show document state, extracted field counts, and a clear "Launch EvaluateIQ" call-to-action when the demand package is published.

### Files

| File | Action |
|------|--------|
| `supabase/config.toml` | Modify — add 3 missing function entries |
| `supabase/functions/extract-demand/index.ts` | Modify — fix job status filter |
| `supabase/functions/orchestrate-intake/index.ts` | Modify — add auto-publish after assemble |
| `src/App.tsx` | Modify — fix route nesting |
| `src/hooks/useIntakeEvaluationPackage.ts` | Modify — add polling for in-progress packages |
| `src/components/case/CaseOverview.tsx` | Modify — add extraction status + EvaluateIQ launch CTA |

