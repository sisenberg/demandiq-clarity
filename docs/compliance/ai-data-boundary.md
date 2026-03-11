# CasualtyIQ — AI Data Boundary Review

> **Status**: Readiness hardening baseline. Not a certification claim.

## 1. AI Subprocessor Paths

All AI calls route through the **Lovable AI Gateway** (`https://ai.gateway.lovable.dev/v1/chat/completions`) which proxies to upstream models (currently Google Gemini 2.5 Flash).

### Path Inventory

| Edge Function | AI Task | Data Sent to AI | PHI/PII Exposure | Minimum Necessary? | Notes |
|---|---|---|---|---|---|
| `process-document` | OCR text extraction | Raw document image bytes (base64) | **L4 — Full PHI/PII** (medical records, names, SSNs, etc.) | ⚠️ No — full page images sent | Cannot be reduced: OCR requires full image. Contractual review needed. |
| `classify-document` | Document type classification + metadata extraction | First 8000 chars of extracted text, file name | **L4 — PHI/PII present** in extracted text | ⚠️ Partial — text truncated to 8000 chars but not de-identified | Could reduce: strip known PII before classification. Trade-off: classification accuracy. |
| `normalize-entities` | Entity resolution/clustering | Extracted names, identifiers, document IDs, confidence scores, source snippets | **L3 — PII** (names, claim numbers) | ✅ Mostly — only entity values + minimal context sent | Good: sends structured values, not raw text. |
| `generate-chronology` | Timeline event extraction | Up to 20000 chars of document text, metadata, facts, claimant name, claim number, DOL | **L4 — Full PHI/PII** (medical text, names, dates) | ⚠️ No — large text blocks with embedded PHI | Hardest to minimize: chronology requires understanding full medical narratives. |

## 2. Risk Assessment

### HIGH — Requires Contractual Coverage Before Production

| Path | Risk | Mitigation |
|---|---|---|
| `process-document` (OCR) | Raw document images containing unrestricted PHI sent to external AI | BAA or equivalent data processing agreement with Lovable/AI provider required |
| `generate-chronology` | 20KB+ of medical narrative text with embedded PHI sent to AI | Same BAA requirement; consider chunking to reduce exposure |

### MEDIUM — Should Be Addressed

| Path | Risk | Mitigation |
|---|---|---|
| `classify-document` | 8KB of document text with embedded PII/PHI sent for classification | Pre-strip known PII identifiers (SSN, DOB, phone) before sending; retain only structural text |
| All paths | AI gateway may log request/response payloads | Verify Lovable AI Gateway data retention and logging policies |

### LOW — Acceptable with Current Controls

| Path | Risk | Mitigation |
|---|---|---|
| `normalize-entities` | Structured PII values (names, claim numbers) sent for clustering | Minimum necessary data; no raw text blocks |

## 3. Boundary Configuration

A config-driven AI boundary control is implemented in `src/lib/ai-boundary.ts`:

```typescript
AI_BOUNDARY_CONFIG = {
  'process-document': {
    approved: true,      // OCR requires raw images
    dataLevel: 'L4',
    requiresBAA: true,
    notes: 'Full document images — cannot be de-identified'
  },
  // ...
}
```

Each edge function checks this config at invocation time. Paths not explicitly approved will fail with a compliance error.

## 4. Recommendations

1. **Immediate**: Execute BAA or DPA with Lovable AI Gateway provider before handling real patient data.
2. **Short-term**: Add PII stripping to `classify-document` for fields not needed for classification (SSN, phone, email, address).
3. **Medium-term**: Evaluate on-premise or BAA-covered OCR provider for `process-document` to reduce PHI exposure to AI models.
4. **Long-term**: Implement a de-identification preprocessor that strips/replaces PII before AI calls and re-maps after response.

## 5. Current Gaps

| ID | Gap | Severity |
|---|---|---|
| AI-001 | No BAA with Lovable AI Gateway / upstream model provider | **Critical** for production PHI |
| AI-002 | `classify-document` sends unnecessary PII in document text | Medium |
| AI-003 | `generate-chronology` sends large PHI-containing text blocks | Medium (unavoidable for function) |
| AI-004 | AI Gateway data retention/logging policy not documented | Medium |
| AI-005 | No de-identification preprocessor exists | Low (future enhancement) |
