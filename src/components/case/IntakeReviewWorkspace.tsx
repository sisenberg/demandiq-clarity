/**
 * Human Review Workspace for OCR-extracted intake data.
 * Side-by-side evidence viewing with field-level correction tracking.
 */

import { useState, useCallback } from "react";
import {
  CheckCircle2, XCircle, Pencil, FileText, Clock,
  User, Shield, ChevronDown, ChevronRight, Eye,
  DollarSign, Activity, Bone, AlertTriangle,
} from "lucide-react";
import { useIntakeEvaluationPackage } from "@/hooks/useIntakeEvaluationPackage";
import {
  useIntakeReviewCorrections,
  useUpsertCorrection,
  useVerifySection,
  type ReviewSection,
  type IntakeReviewCorrectionRow,
} from "@/hooks/useIntakeReviewCorrections";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  caseId: string;
  tenantId: string;
}

interface FieldDef {
  key: string;
  label: string;
  getValue: (pkg: any) => string;
}

const DEMAND_FIELDS: FieldDef[] = [
  { key: "claimant_name", label: "Claimant Name", getValue: (p) => p.claimant_name ?? "" },
  { key: "attorney_name", label: "Attorney Name", getValue: (p) => p.attorney_name ?? "" },
  { key: "law_firm", label: "Law Firm", getValue: (p) => p.law_firm ?? "" },
  { key: "represented_status", label: "Represented Status", getValue: (p) => p.represented_status ?? "" },
  { key: "demand_amount", label: "Demand Amount", getValue: (p) => p.demand_amount != null ? `$${Number(p.demand_amount).toLocaleString()}` : "" },
  { key: "demand_deadline", label: "Demand Deadline", getValue: (p) => p.demand_deadline ?? "" },
];

const SECTION_CONFIG: Record<ReviewSection, { label: string; icon: React.ElementType; color: string }> = {
  demand: { label: "Demand Fields", icon: FileText, color: "text-primary" },
  specials: { label: "Medical Specials", icon: DollarSign, color: "text-[hsl(var(--status-attention))]" },
  treatment: { label: "Treatment Timeline", icon: Activity, color: "text-[hsl(var(--status-processing))]" },
  injury: { label: "Injury Facts", icon: Bone, color: "text-destructive" },
};

const IntakeReviewWorkspace = ({ caseId, tenantId }: Props) => {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data: pkg, isLoading: pkgLoading } = useIntakeEvaluationPackage(caseId);
  const { data: corrections, isLoading: corrLoading } = useIntakeReviewCorrections(caseId);
  const upsertCorrection = useUpsertCorrection();
  const verifySection = useVerifySection();
  const [activeSection, setActiveSection] = useState<ReviewSection>("demand");
  const [evidencePane, setEvidencePane] = useState<{ snippet: string; page: number | null; docId: string | null } | null>(null);

  const isLoading = pkgLoading || corrLoading;

  if (isLoading) {
    return (
      <div className="card-elevated p-8 flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="card-elevated p-8 text-center">
        <Shield className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No intake package assembled yet. Assemble a package first to begin review.</p>
      </div>
    );
  }

  const correctionMap = new Map<string, IntakeReviewCorrectionRow>();
  (corrections ?? []).forEach((c) => correctionMap.set(`${c.section}::${c.field_name}`, c));

  const verificationStatus = {
    demand: { verified: (pkg as any).demand_verified ?? false, by: (pkg as any).demand_verified_by, at: (pkg as any).demand_verified_at },
    specials: { verified: (pkg as any).specials_verified ?? false, by: (pkg as any).specials_verified_by, at: (pkg as any).specials_verified_at },
    treatment: { verified: (pkg as any).treatment_verified ?? false, by: (pkg as any).treatment_verified_by, at: (pkg as any).treatment_verified_at },
    injury: { verified: (pkg as any).injury_verified ?? false, by: (pkg as any).injury_verified_by, at: (pkg as any).injury_verified_at },
  };

  const verifiedCount = Object.values(verificationStatus).filter((v) => v.verified).length;

  const handleVerify = (section: ReviewSection, verified: boolean) => {
    verifySection.mutate({ packageId: pkg.id, section, verified, userId });
  };

  // Build specials/treatment/injury field lists from package data
  const specialsFields: FieldDef[] = ((pkg.specials_summary as any)?.lines ?? []).map((line: any, i: number) => ({
    key: `special_${i}`,
    label: `${line.provider_name ?? "Unknown"} — ${line.date_of_service ?? "No date"}`,
    getValue: () => `$${(line.billed_amount ?? 0).toLocaleString()} · CPT: ${line.cpt_code ?? "—"} · ${line.verification_status ?? "pending"}`,
  }));

  const treatmentFields: FieldDef[] = [];
  const ts = pkg.treatment_summary as any;
  if (ts) {
    treatmentFields.push(
      { key: "total_events", label: "Total Events", getValue: () => String(ts.total_events ?? 0) },
      { key: "first_treatment", label: "First Treatment", getValue: () => ts.first_treatment_date ?? "—" },
      { key: "last_treatment", label: "Last Treatment", getValue: () => ts.last_treatment_date ?? "—" },
      { key: "duration_days", label: "Duration (days)", getValue: () => String(ts.treatment_duration_days ?? 0) },
      { key: "provider_count", label: "Providers", getValue: () => String(ts.provider_count ?? 0) },
    );
    // Add event type breakdown
    const types = ts.event_types ?? {};
    Object.entries(types).forEach(([type, count]) => {
      treatmentFields.push({ key: `type_${type}`, label: `Event: ${type}`, getValue: () => String(count) });
    });
  }

  const injuryFields: FieldDef[] = (pkg.injury_summary as any[]).map((inj: any, i: number) => ({
    key: `injury_${i}`,
    label: inj.body_part || `Injury ${i + 1}`,
    getValue: () => {
      const flags = [
        inj.objective_support_flag && "Objective",
        inj.invasive_treatment_flag && "Invasive",
        inj.residual_symptom_flag && "Residual",
        inj.functional_impact_flag && "Functional",
      ].filter(Boolean).join(", ");
      return `${inj.injury_description ?? "—"} · ICD: ${(inj.icd_codes ?? []).join(", ") || "—"} · Flags: ${flags || "None"}`;
    },
  }));

  const sectionFieldMap: Record<ReviewSection, FieldDef[]> = {
    demand: DEMAND_FIELDS,
    specials: specialsFields,
    treatment: treatmentFields,
    injury: injuryFields,
  };

  return (
    <div className="flex gap-0 h-full min-h-[500px]">
      {/* Left panel — section navigation + fields */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Section tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card shrink-0">
          {(Object.keys(SECTION_CONFIG) as ReviewSection[]).map((section) => {
            const cfg = SECTION_CONFIG[section];
            const Icon = cfg.icon;
            const verified = verificationStatus[section].verified;
            return (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                  activeSection === section
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {verified ? (
                  <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))]" />
                ) : (
                  <Icon className={`h-3 w-3 ${activeSection === section ? cfg.color : ""}`} />
                )}
                {cfg.label}
              </button>
            );
          })}

          <div className="flex-1" />
          <span className="text-[9px] text-muted-foreground font-mono tabular-nums">
            {verifiedCount}/4 verified
          </span>
        </div>

        {/* Section header with verify button */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-accent/20 shrink-0">
          <div className="flex items-center gap-2">
            {(() => { const Icon = SECTION_CONFIG[activeSection].icon; return <Icon className={`h-4 w-4 ${SECTION_CONFIG[activeSection].color}`} />; })()}
            <h3 className="text-[13px] font-semibold text-foreground">{SECTION_CONFIG[activeSection].label}</h3>
            {verificationStatus[activeSection].verified && (
              <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]">
                Verified
              </span>
            )}
          </div>
          <button
            onClick={() => handleVerify(activeSection, !verificationStatus[activeSection].verified)}
            disabled={verifySection.isPending}
            className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
              verificationStatus[activeSection].verified
                ? "border border-[hsl(var(--status-approved))]/30 bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))] hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {verificationStatus[activeSection].verified ? (
              <><XCircle className="h-3 w-3" /> Unverify</>
            ) : (
              <><CheckCircle2 className="h-3 w-3" /> Mark Verified</>
            )}
          </button>
        </div>

        {/* Field rows */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-border">
            {sectionFieldMap[activeSection].length === 0 ? (
              <div className="px-5 py-8 text-center">
                <AlertTriangle className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-[11px] text-muted-foreground">No data extracted for this section.</p>
              </div>
            ) : (
              sectionFieldMap[activeSection].map((field) => (
                <ReviewFieldRow
                  key={field.key}
                  field={field}
                  pkg={pkg}
                  section={activeSection}
                  correction={correctionMap.get(`${activeSection}::${field.key}`)}
                  caseId={caseId}
                  tenantId={tenantId}
                  userId={userId}
                  onUpsert={upsertCorrection}
                  onViewEvidence={(snippet, page, docId) => setEvidencePane({ snippet, page, docId })}
                />
              ))
            )}
          </div>
        </div>

        {/* Verification metadata footer */}
        {verificationStatus[activeSection].verified && verificationStatus[activeSection].at && (
          <div className="px-5 py-2 border-t border-border bg-accent/30 flex items-center gap-2 text-[9px] text-muted-foreground shrink-0">
            <User className="h-3 w-3" />
            Verified by {verificationStatus[activeSection].by ?? "—"}
            <Clock className="h-3 w-3 ml-2" />
            {new Date(verificationStatus[activeSection].at!).toLocaleString()}
          </div>
        )}
      </div>

      {/* Right panel — evidence viewer */}
      <div className="w-[360px] border-l border-border bg-accent/10 flex flex-col shrink-0 hidden lg:flex">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-foreground">Evidence Reference</span>
        </div>
        {evidencePane ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {evidencePane.page != null && (
              <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                <FileText className="h-3 w-3" />
                Page {evidencePane.page}
                {evidencePane.docId && <span className="font-mono">· {evidencePane.docId.slice(0, 8)}</span>}
              </div>
            )}
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap">
                {evidencePane.snippet || "No source snippet available."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <Eye className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-[10px] text-muted-foreground">
                Click a field's evidence icon to view the source snippet.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Field Row Component ────────────────────────────────

function ReviewFieldRow({
  field, pkg, section, correction, caseId, tenantId, userId, onUpsert, onViewEvidence,
}: {
  field: FieldDef;
  pkg: any;
  section: ReviewSection;
  correction?: IntakeReviewCorrectionRow;
  caseId: string;
  tenantId: string;
  userId: string;
  onUpsert: ReturnType<typeof useUpsertCorrection>;
  onViewEvidence: (snippet: string, page: number | null, docId: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const extractedValue = field.getValue(pkg);
  const hasCorrected = correction?.corrected_value != null && correction.corrected_value !== extractedValue;
  const displayValue = hasCorrected ? correction!.corrected_value! : extractedValue;

  const handleSave = () => {
    if (editValue.trim() === extractedValue) {
      setEditing(false);
      return;
    }
    onUpsert.mutate({
      caseId, tenantId, section,
      fieldName: field.key,
      extractedValue,
      correctedValue: editValue.trim(),
      userId,
      evidenceDocumentId: correction?.evidence_document_id ?? undefined,
      evidencePage: correction?.evidence_page ?? undefined,
      evidenceSnippet: correction?.evidence_snippet ?? undefined,
    }, {
      onSuccess: () => setEditing(false),
    });
  };

  return (
    <div className="px-5 py-3 hover:bg-accent/30 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Label */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              {field.label}
            </span>
            {hasCorrected && (
              <span className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0 rounded bg-primary/10 text-primary">
                Corrected
              </span>
            )}
          </div>

          {/* Value display / edit */}
          {editing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-[11px] rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <button
                onClick={handleSave}
                disabled={onUpsert.isPending}
                className="text-[9px] font-medium px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-[9px] font-medium px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className={`text-[12px] leading-relaxed ${hasCorrected ? "text-primary font-medium" : "text-foreground"}`}>
              {displayValue || <span className="text-muted-foreground italic">Empty</span>}
            </p>
          )}

          {/* Original extracted value when corrected */}
          {hasCorrected && !editing && (
            <p className="text-[9px] text-muted-foreground line-through mt-0.5">
              Original: {extractedValue}
            </p>
          )}

          {/* Correction metadata */}
          {correction?.corrected_by && (
            <div className="flex items-center gap-2 mt-1 text-[8px] text-muted-foreground">
              <User className="h-2.5 w-2.5" />
              {correction.corrected_by.slice(0, 8)}
              <Clock className="h-2.5 w-2.5" />
              {correction.corrected_at ? new Date(correction.corrected_at).toLocaleString() : "—"}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-1">
          {!editing && (
            <button
              onClick={() => { setEditValue(displayValue); setEditing(true); }}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
              title="Edit value"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {(correction?.evidence_snippet || correction?.evidence_page) && (
            <button
              onClick={() => onViewEvidence(
                correction?.evidence_snippet ?? "",
                correction?.evidence_page ?? null,
                correction?.evidence_document_id ?? null
              )}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-primary"
              title="View evidence"
            >
              <Eye className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default IntakeReviewWorkspace;
