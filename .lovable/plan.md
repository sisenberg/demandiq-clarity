

## Simplified Intake Pipeline Flow

The current `IntakeWorkflowDashboard` displays 10 granular pipeline steps. Your diagram shows an 8-step user-facing flow that is cleaner and more intuitive. Here is the plan to align the UI.

### What changes

**1. Update `intakeWorkflowEngine.ts`** — Add a new `computeSimplifiedPipeline` function that maps to your 8 steps:

| # | Step | Completion signal |
|---|------|-------------------|
| 1 | Documents Uploaded | `totalDocuments > 0` |
| 2 | OCR Processed | `ocrCompleteCount >= totalDocuments` |
| 3 | Demand Identified | `hasDemand === true` |
| 4 | Bills Extracted | `specialsCount > 0` |
| 5 | Treatment Timeline Built | `treatmentCount > 0` |
| 6 | Injuries Extracted | `injuryCount > 0` |
| 7 | Demand Record Created | All 4 sections verified + no blockers |
| 8 | Ready for EvaluateIQ | `packageStatus === "published_to_evaluateiq"` |

Keep the existing 10-step detail pipeline for the expanded/advanced view.

**2. Update `IntakeWorkflowDashboard.tsx`** — Replace the default view with a vertical flow layout matching your diagram:
- Each step shown as a node with a connecting arrow (`↓`)
- Green check for complete, spinner for in-progress, hollow circle for pending
- Step label + optional detail count (e.g., "3 records")
- Collapsible "Show detailed pipeline" toggle to reveal the full 10-step view underneath

**3. Minor hook update in `useIntakeWorkflow.ts`** — Expose both `steps` (10-step detail) and `simplifiedSteps` (8-step flow) from the computed result.

No database changes needed. No new dependencies.

