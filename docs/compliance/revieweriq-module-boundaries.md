# ReviewerIQ Module Boundaries — Technical Reference

**Module ID:** `revieweriq`  
**Contract version:** 1.0.0  
**Last updated:** 2026-03-11

---

## 1. What ReviewerIQ Reads (Upstream — Read-Only)

ReviewerIQ consumes the completed DemandIQ snapshot via `useReviewerIQInput(caseId)`. It never queries upstream tables directly.

| Data | Source | Access |
|---|---|---|
| `case_record` | `cases` table | Read-only via snapshot |
| `parties` | `case_parties` table | Read-only via snapshot |
| `documents` | `case_documents` (slim refs, no `extracted_text`) | Read-only via snapshot |
| `source_pages` | `document_pages` | Read-only via snapshot |
| `injuries` | `injuries` table | Read-only via snapshot |
| `providers` | Derived from `case_parties` + entity clusters | Read-only via snapshot |
| `treatments` | `treatment_records` (platform-wide) | Read-only via snapshot |
| `billing_lines` | `bills` table | Read-only via snapshot |
| `insurance_policies` | `insurance_policies` table | Read-only via snapshot |
| `liability_facts` | `liability_facts` table | Read-only via snapshot |
| `timeline_events` | `chronology_event_candidates` | Read-only via snapshot |
| `evidence_refs` | `chronology_evidence_links` | Read-only via snapshot |
| `issue_flags` | DemandIQ-generated flags | Read-only via snapshot |
| `demand_summary` | DemandIQ completion output | Read-only via snapshot |

**Key invariant:** ReviewerIQ never writes to any table listed above.

## 2. What ReviewerIQ Owns (Internal — Read/Write)

| Table | Purpose |
|---|---|
| `reviewer_treatment_records` | AI-extracted treatment records with SOAP fields, structured clinical data, provenance, and review state |
| `reviewer_extraction_jobs` | Async extraction job tracking (status, model version, record/duplicate counts) |
| `reviewer_case_state` *(planned)* | Per-case review lifecycle, upstream snapshot reference, summary counters |
| `reviewer_treatment_reviews` *(planned)* | Treatment reasonableness assessment (AI decision, accepted decision, guidelines) |
| `reviewer_provider_reviews` *(planned)* | Provider normalization tracking (canonical values, status) |
| `reviewer_bill_links` | Bill-to-treatment linkage with assessed reasonable amounts |
| `reviewer_medical_flags` *(planned)* | Medical review flags (category, severity, status, evidence traceability) |

### Client-side readiness engine

The `reviewReadiness.ts` module computes a first-pass readiness assessment from treatment records without persisting to the database:

- **10 flag categories:** missing_date, missing_provider, duplicate_visit, bill_no_treatment, treatment_no_bill, inconsistent_provider, chronology_gap, ambiguous_extraction, unsupported_code_format, low_confidence
- **3 readiness states:** not_ready, partially_ready, review_ready
- **Scoring:** 100-point scale with configurable thresholds

## 3. What Future Medical Review Engines Will Consume

Downstream modules (EvaluateIQ, NegotiateIQ) will consume ReviewerIQ output via the same snapshot pattern:

| Output | Description | Consumer |
|---|---|---|
| Reviewed treatment records | Accepted/corrected treatment records with reviewer notes | EvaluateIQ, NegotiateIQ |
| Provider normalization | Canonical provider names, NPI mappings | EvaluateIQ |
| Bill-treatment linkage | Confirmed bill-to-visit associations with reasonableness assessments | NegotiateIQ |
| Medical flags | Categorized review findings (gaps, duplicates, coding issues) | EvaluateIQ |
| Readiness status | Case-level review readiness for workflow gating | All downstream |

### AMA/Medicare analysis boundary

The current readiness engine is explicitly a **first-pass review layer**. It does not:

- Assess medical necessity per AMA guidelines
- Apply Medicare fee schedule comparisons
- Generate Colossus-style severity ratings
- Produce impairment ratings

These capabilities belong to a future `EvaluateIQ` module that will consume ReviewerIQ's reviewed treatment dataset as its input contract.

## 4. Data Classification

| Field Category | Classification | Logging Policy |
|---|---|---|
| Treatment SOAP summaries | L4 (PHI) | `[REDACTED]` in all logs |
| Diagnosis descriptions | L4 (PHI) | `[REDACTED]` in all logs |
| Source snippets / quoted text | L4 (PHI) | `[REDACTED]` in all logs |
| Provider names | L3 (PII) | `[REDACTED]` in all logs |
| Record IDs, case IDs | L1 (pseudonymous) | Allowed in logs |
| Visit types, confidence scores | L1 (metadata) | Allowed in logs |
| Review state, flag categories | L1 (metadata) | Allowed in logs |

## 5. Evidence Traceability

Every ReviewerIQ record preserves its extraction provenance:

```
reviewer_treatment_record
  ├── source_document_id → case_documents.id
  ├── source_page_start / source_page_end
  ├── source_snippet (quoted text from source)
  ├── extraction_model (e.g., "google/gemini-3-flash-preview")
  ├── extraction_version (semantic version)
  └── extracted_at (timestamp)
```

## 6. Test Coverage

Test fixtures in `src/test/fixtures/treatmentFixtures.ts` cover:

1. **Single-provider soft tissue course** — 3 records, same provider, sequential dates
2. **Multi-provider escalating care** — 4 records across ER → ortho → imaging → pain mgmt
3. **Duplicate record scenario** — 2 records flagged as near-duplicates
4. **Bill without treatment note** — Low-confidence record with billing but no clinical content
5. **Treatment note without bill** — Clinical record with no associated billing
6. **Ambiguous provider naming** — 3 records with variant spellings of the same provider

Edge cases: missing date, missing provider, ambiguous date, unsupported code formats.
