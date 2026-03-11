# ReviewerIQ — Specialty Review Rule Architecture v1.0.0

## Overview

The specialty review engine provides deeper clinical review logic for six specialties: **Chiropractic**, **Physical Therapy**, **Orthopedics**, **Pain Management**, **Radiology**, and **Surgery**. It generates structured, explainable review recommendations for human reviewers without automating medical necessity decisions.

## 3-Layer Architecture

### Layer 1: Base Coding/Payment
- **NCCI/PTP conflict detection**: Identifies code pairs that may represent bundling conflicts.
- **MUE (Medically Unlikely Edit) checks**: Flags units exceeding per-date-of-service limits.
- **Therapy timed-unit plausibility**: Validates CMS 8-minute rule compliance for timed PT/OT codes.
- **Global surgery period enforcement**: Detects post-operative billing within global surgery windows.

### Layer 2: Specialty Clinical Logic
Each specialty module runs domain-specific heuristics:

| Specialty | Key Checks |
|---|---|
| **Chiro** | Mechanism, exam findings, treatment plan, cloned notes, passive ratio, duration |
| **PT** | Evaluation present, measurable goals, active vs passive ratio, progression, re-evals |
| **Ortho** | ROM/strength/neuro, imaging concordance, body-part expansion, conservative care |
| **Pain Mgmt** | Prior conservative care, injection benefit, opioid risk documentation, imaging support |
| **Radiology** | Early imaging without red flags, duplicate studies, finding classification, concordance |
| **Surgery** | Imaging concordance, conservative care trial, objective deficits, urgent exceptions |

### Layer 3: Jurisdiction/Client Overlay (Pluggable — Stub in v1)
Designed for future integration of:
- State-specific fee schedule rules
- Carrier-specific preferences and guidelines
- Claim-type overlays (WC, auto, GL, med-mal)
- Custom client thresholds

**No state rules are hardcoded into the base engine.**

## Output Schema

Each recommendation includes:
- `support_level`: supported | partially_supported | weakly_supported | unsupported | escalate
- `documentation_sufficiency_score`: 0–100
- `coding_integrity_score`: 0–100
- `necessity_support_score`: 0–100
- `issue_tags[]`: Typed, severity-rated findings with explanations
- `reimbursement_adjustments[]`: Coded adjustment reasons with impact
- `narrative_explanation`: Plain-language summary
- `evidence_links[]`: Source document references
- `confidence`: 0–1 probability
- `escalation_required`: Boolean (always true for surgery)

## Safety Constraints

1. **Never outputs "deny care" or "coverage denied"** — uses support_level enum only.
2. **Surgery always requires human review** — mandatory escalation.
3. **Opioid escalation and repeat invasive procedures** flag for human review.
4. **Not presented as legal advice or medical diagnosis.**
5. **Every recommendation requires reviewer disposition** before downstream consumption.

## Episode Grouping

Treatment lines are grouped into episodes of care by:
- Provider name (normalized)
- Body region
- Diagnosis cluster
- Date span continuity

Phases are classified as: acute (≤30 days), subacute (31–90 days), chronic (>90 days), or postop (surgical codes present).

## Deferred to Future Phases

- AMA guideline-specific compliance scoring
- External NPI/provider database enrichment
- Real-time NCCI quarterly update integration
- Carrier-specific fee schedule lookups
- Multi-jurisdiction rule overlay engine
- Peer review integration
