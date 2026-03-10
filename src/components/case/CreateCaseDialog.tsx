import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateCase } from "@/hooks/useCases";
import { X } from "lucide-react";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

interface CreateCaseDialogProps {
  open: boolean;
  onClose: () => void;
}

const CreateCaseDialog = ({ open, onClose }: CreateCaseDialogProps) => {
  const navigate = useNavigate();
  const createCase = useCreateCase();
  const [form, setForm] = useState({
    claim_number: "",
    external_reference: "",
    claimant: "",
    insured: "",
    date_of_loss: "",
    jurisdiction_state: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
  });

  if (!open) return null;

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createCase.mutateAsync(form);
    onClose();
    navigate(`/cases/${result.id}`);
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "block text-xs font-medium text-foreground mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-lg shadow-lg w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Create New Case</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Claim Number</label>
              <input className={inputClass} placeholder="CLM-2024-001" value={form.claim_number} onChange={(e) => set("claim_number", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>External Reference</label>
              <input className={inputClass} placeholder="EXT-REF-001" value={form.external_reference} onChange={(e) => set("external_reference", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Claimant Name *</label>
              <input className={inputClass} required placeholder="Jane Doe" value={form.claimant} onChange={(e) => set("claimant", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Insured Name *</label>
              <input className={inputClass} required placeholder="Acme Corp" value={form.insured} onChange={(e) => set("insured", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Date of Loss</label>
              <input type="date" className={inputClass} value={form.date_of_loss} onChange={(e) => set("date_of_loss", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Jurisdiction</label>
              <select className={inputClass} value={form.jurisdiction_state} onChange={(e) => set("jurisdiction_state", e.target.value)}>
                <option value="">Select state</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <select className={inputClass} value={form.priority} onChange={(e) => set("priority", e.target.value as any)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium rounded-md border border-border bg-card text-foreground hover:bg-accent transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createCase.isPending} className="px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createCase.isPending ? "Creating…" : "Create Case"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCaseDialog;
