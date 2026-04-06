import { Search } from "lucide-react";
import { maskClaimNumber } from "@/lib/phi-utils";

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface ClaimHeaderProps {
  claimantName: string;
  claimNumber: string;
  doi: string | null;
  onNavigate?: (section: string) => void;
}

const ClaimHeader = ({ claimantName, claimNumber, doi, onNavigate }: ClaimHeaderProps) => {
  return (
    <div className="flex items-center justify-between py-1">
      <h1 className="text-base font-semibold text-foreground tracking-tight">
        <span className="text-muted-foreground font-medium text-sm">DEMAND</span>
        <span className="text-muted-foreground/40 mx-2">—</span>
        {claimantName || "Claimant"}
      </h1>
      <button
        onClick={() => onNavigate?.("documents")}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Find Evidence for Statement</span>
      </button>
    </div>
  );
};

export default ClaimHeader;
