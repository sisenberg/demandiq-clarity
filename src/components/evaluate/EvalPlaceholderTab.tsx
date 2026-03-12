import EmptyState from "@/components/ui/EmptyState";
import { BarChart3, Send } from "lucide-react";

interface Props {
  tab: "calibration" | "handoff";
}

const config = {
  calibration: {
    icon: BarChart3,
    title: "Historical Calibration",
    description: "Compare this case against historical verdicts and settlements for similar injury profiles, jurisdictions, and liability postures. This area will surface comparable outcomes and calibration data points.",
  },
  handoff: {
    icon: Send,
    title: "Handoff",
    description: "Package the finalized valuation with supporting evidence, assumptions, and range documentation for downstream modules or external distribution.",
  },
};

const EvalPlaceholderTab = ({ tab }: Props) => {
  const c = config[tab];
  return (
    <div className="mt-12">
      <EmptyState
        icon={c.icon}
        title={c.title}
        description={c.description}
      />
    </div>
  );
};

export default EvalPlaceholderTab;
