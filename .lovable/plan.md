

## Diagnosis: Pipeline Stalled Due to Garbled OCR

### Current State
The uploaded document (`PIP DEMAND PT 1.pdf`) went through this flow:
1. **Upload** -- succeeded
2. **Text extraction** -- "completed" but produced garbled text: *"This is a garbled text and it's impossible to clean it up or restore any meaningful content."*
3. **Classification** -- ran (pipeline_stage = `document_classified`) but classified as `unknown` because the AI saw garbage text
4. **Orchestration** -- `orchestrate-intake` found `unknown` type, so no extraction routes matched, and it stopped

The `duplicate_detection` job is permanently stuck as `queued` (no function handles it).

There are **no** `document_chunking` or `document_parsing` job records, suggesting `classify-document` or `chunk-document` may not have created them, or they ran but didn't persist jobs.

### Root Cause
The PDF is likely a scanned/image-based document. The `process-document` function:
1. Checked if it was "born-digital" via regex -- found BT/Tj operators (possibly false positive)
2. Tried to extract text via `extractBornDigitalPages` -- got sparse/garbled results
3. Fell back to `extractAllPdfText` regex -- also garbled
4. Sent garbled raw text to Gemini for "cleanup" -- Gemini correctly replied it was impossible to clean up
5. Stored the Gemini response as the "extracted text"

The fix: **use Gemini's native PDF processing** instead of regex extraction. Gemini 2.5 Flash accepts `application/pdf` as `inline_data`, so we can send the full PDF binary and let it do proper OCR.

### Plan

#### 1. Fix `process-document` to use native PDF vision OCR
When born-digital extraction fails or produces poor results, send the full PDF as base64 `inline_data` with MIME `application/pdf` to Gemini instead of sending garbled regex-extracted text for "cleanup."

```text
Current flow:
  PDF → regex extract → send text to AI for cleanup → store

Fixed flow:
  PDF → try born-digital → if poor quality → send full PDF binary to Gemini vision → store
```

Key change in the OCR fallback path (~lines 408-520):
- Instead of calling `extractAllPdfText` and sending raw text for cleanup, encode the full PDF as base64 and send it as `inline_data` with `mimeType: "application/pdf"` to Gemini
- Use the existing `LovableAiOcrProvider` pattern but adapted for full-PDF input
- Keep the scanned-PDF-no-text guard only if the file is too large (>15MB)

#### 2. Add quality gate after born-digital extraction
After `extractBornDigitalPages`, check text quality (not just length). If the extracted text looks like encoding garbage (high ratio of non-ASCII or control characters), skip to OCR instead of using it.

#### 3. Re-process the existing document
After deploying the fix, invoke `process-document` for the existing job to re-run OCR with the improved path. This requires:
- Resetting the `text_extraction` job status back to `queued`
- Calling `process-document` with the job ID
- The downstream chain (classify → orchestrate → extract-demand) will then fire automatically

#### 4. Clean up stuck `duplicate_detection` job
The `duplicate_detection` job type has no handler. Either remove it or mark it as not-applicable to unblock the polling UI.

### Technical Details

**File changes:**
- `supabase/functions/process-document/index.ts` -- Replace the text-cleanup AI call with native PDF vision call; add text quality gate

**No schema changes needed.**

**Deployment:** Redeploy `process-document`, then invoke it with the existing job ID to test end-to-end.

