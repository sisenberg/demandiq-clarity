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
    <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
      {TYPE_LABELS[type] ?? type}
    </span>
  );
};

export { TYPE_LABELS };
export default DocumentTypeTag;
