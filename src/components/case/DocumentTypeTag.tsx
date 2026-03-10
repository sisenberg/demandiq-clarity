const TYPE_LABELS: Record<string, string> = {
  medical_record: "Medical Record",
  police_report: "Police Report",
  legal_filing: "Legal Filing",
  correspondence: "Correspondence",
  billing_record: "Billing Record",
  imaging_report: "Imaging Report",
  insurance_document: "Insurance Document",
  employment_record: "Employment Record",
  expert_report: "Expert Report",
  photograph: "Photograph",
  other: "Other",
};

const DocumentTypeTag = ({ type }: { type: string }) => {
  return (
    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground">
      {TYPE_LABELS[type] ?? type}
    </code>
  );
};

export { TYPE_LABELS };
export default DocumentTypeTag;
