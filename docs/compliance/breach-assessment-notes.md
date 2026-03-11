# CasualtyIQ — Breach Assessment Notes

> **Status**: Developer-facing reference for breach triage. Not a formal breach notification plan.

## 1. HIPAA Breach Assessment Framework

Under HIPAA, a breach is the unauthorized acquisition, access, use, or disclosure of PHI that compromises the security or privacy of the PHI. The assessment follows a 4-factor test:

1. **Nature and extent of PHI involved** (types of identifiers, clinical data)
2. **Unauthorized person who used or received the PHI**
3. **Whether PHI was actually acquired or viewed**
4. **Extent to which risk has been mitigated**

## 2. PHI Locations in CasualtyIQ

| Location | PHI Content | Identifiers Present | Access Controls |
|---|---|---|---|
| `case_documents.extracted_text` | Full medical narratives | Names, DOB, MRN, diagnoses, treatments | RLS (tenant-scoped) |
| `document_pages.extracted_text` | Per-page OCR text | Same as above | RLS (tenant-scoped) |
| `extracted_facts.fact_text` | Structured medical facts | Diagnoses, treatments, providers | RLS (tenant-scoped) |
| `chronology_event_candidates` | Timeline events with medical detail | Names, dates, medical events | RLS (tenant-scoped) |
| `case_parties` | Contact information | Names, phone, email, address | RLS (tenant-scoped) |
| `cases.claimant` | Claimant name | Full name | RLS (tenant-scoped) |
| `injuries` | Diagnosis details | Body part, diagnosis code, severity | RLS (tenant-scoped) |
| `treatment_records` | Treatment details | Provider, facility, procedure codes | RLS (tenant-scoped) |
| `bills` | Billing information | Amounts, CPT codes, provider | RLS (tenant-scoped) |
| Storage: `case-documents` | Raw uploaded files | All PHI in original documents | RLS + signed URLs |
| Storage: `derived-artifacts` | Generated reports | Assembled PHI from case data | RLS + signed URLs |
| AI Gateway (in transit) | Document text sent for processing | All PHI in transmitted text | TLS + API key auth |

## 3. Breach Scenarios and Assessment

### Scenario A: User Account Compromise
- **Scope**: Single tenant's data (RLS limits access)
- **PHI affected**: All cases accessible to that user within their tenant
- **Assessment query**: `SELECT COUNT(*) FROM cases WHERE tenant_id = '<tenant>'`
- **Identifiers**: Names, medical data, contact info
- **Mitigation**: Disable account, rotate credentials, review audit trail

### Scenario B: Service-Role Key Compromise
- **Scope**: ALL tenants (service-role bypasses RLS)
- **PHI affected**: Entire database + storage
- **Assessment**: Full database scope — all tenants, all cases
- **Identifiers**: All PHI types
- **Mitigation**: Immediate key rotation, audit edge function invocations

### Scenario C: AI Gateway Data Exposure
- **Scope**: Data sent to AI during processing window
- **PHI affected**: Document text, entity values, chronology content
- **Assessment**: Review edge function logs for affected invocations
- **Identifiers**: Names, medical narratives, dates, identifiers embedded in text
- **Mitigation**: Contact Lovable support for gateway-side assessment

### Scenario D: Signed URL Exposure
- **Scope**: Individual document(s) for duration of URL validity
- **PHI affected**: Raw document content
- **Assessment**: Check `audit_events` for `signed_url_generated` with TTL and timing
- **Identifiers**: All PHI in the original document
- **Mitigation**: URLs self-expire (120-300s TTLs); no revocation mechanism

## 4. Immediate Triage Checklist

```markdown
## Breach Triage Checklist

- [ ] What component was compromised? (auth, database, storage, edge function, AI gateway)
- [ ] Is PHI involved? (Check data class — L4 = yes)
- [ ] How many individuals' PHI may be affected?
- [ ] What types of identifiers are in the affected data?
- [ ] Was PHI actually acquired/viewed, or only potentially accessible?
- [ ] Has the exposure been contained? (key rotated, account disabled, URL expired)
- [ ] What audit evidence exists? (audit_events, function logs, auth logs)
- [ ] Does this require notification? (legal/compliance team decision)
```

## 5. Evidence Preservation

In a potential breach scenario, preserve:

1. **Audit events**: Export `audit_events` for the affected time window
2. **Edge function logs**: Screenshot/export before they rotate out
3. **Auth logs**: Export login/session data for affected accounts
4. **Git history**: Document the state of security controls at time of incident
5. **Signed URL audit trail**: Query `audit_events WHERE action_type = 'signed_url_generated'`

## 6. Notification Considerations

- HIPAA requires notification within 60 days of discovery for breaches affecting ≥500 individuals
- Individual notification required for all affected persons
- HHS notification required
- **This is a legal/compliance decision, not a technical one** — consult counsel

## 7. Current Gaps

| Gap | Description |
|---|---|
| BA-001 | No automated breach detection or anomaly alerting |
| BA-002 | No individual-level PHI access log (only document-level via audit_events) |
| BA-003 | No automated affected-individual enumeration tool |
| BA-004 | No signed URL revocation mechanism (rely on short TTLs) |
| BA-005 | AI gateway-side data retention/breach assessment process not documented |
