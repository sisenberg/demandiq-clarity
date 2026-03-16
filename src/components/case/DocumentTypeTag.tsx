import { getDocumentTypeLabel, getWorkflowRoute, WORKFLOW_LABEL } from "@/lib/statuses";

const WORKFLOW_COLORS: Record<string, string> = {
  demand_extraction: "bg-primary/10 text-primary",
  specials_extraction: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]",
  treatment_extraction: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]",
  general_review: "bg-accent text-muted-foreground",
  pending_classification: "bg-destructive/10 text-destructive",
};

const DocumentTypeTag = ({ type, predictedType, showWorkflow }: {
  type: string;
  predictedType?: string | null;
  showWorkflow?: boolean;
}) => {
  const isPredictionOverridden = predictedType && predictedType !== type && type !== "other";
  const workflow = getWorkflowRoute(type);

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
        {getDocumentTypeLabel(type)}
      </span>
      {isPredictionOverridden && (
        <span className="text-[8px] text-muted-foreground/60 line-through" title={`AI predicted: ${getDocumentTypeLabel(predictedType!)}`}>
          {getDocumentTypeLabel(predictedType!)}
        </span>
      )}
      {showWorkflow && workflow !== "general_review" && (
        <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${WORKFLOW_COLORS[workflow] || ""}`}>
          {WORKFLOW_LABEL[workflow]}
        </span>
      )}
    </span>
  );
};

export default DocumentTypeTag;
