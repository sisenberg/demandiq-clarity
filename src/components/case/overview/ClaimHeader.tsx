import { Search } from "lucide-react";

interface ClaimHeaderProps {
  claimantName: string;
  claimNumber: string;
  doi: string | null;
  onNavigate?: (section: string) => void;
}

const ClaimHeader = ({ claimantName, claimNumber, doi, onNavigate }: ClaimHeaderProps) => {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-sm font-semibold text-foreground tracking-tight">
        <span className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Demand</span>
        <span className="text-border mx-2">—</span>
        <span>{claimantName || "Claimant"}</span>
      </h1>
      <button
        onClick={() => onNavigate?.("documents")}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Search className="h-3 w-3" />
        <span className="hidden sm:inline">Find Evidence</span>
      </button>
    </div>
  );
};

export default ClaimHeader;
