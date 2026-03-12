/**
 * NegotiateIQ — Center Panel: Negotiation strategy & active round
 */

import {
  DollarSign,
  Target,
  ArrowDownUp,
  Zap,
} from "lucide-react";

const NegotiateStrategyPanel = () => {
  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      {/* Opening Position */}
      <PlaceholderCard
        icon={Target}
        title="Opening Position"
        description="Define the initial demand or offer position based on the evaluated range. Factor in anchor strategy and negotiation psychology."
      />

      {/* Active Round */}
      <PlaceholderCard
        icon={ArrowDownUp}
        title="Active Round"
        description="Track the current offer/counteroffer exchange. Each round captures positions, rationale, and adjuster notes."
      />

      {/* Concession Strategy */}
      <PlaceholderCard
        icon={DollarSign}
        title="Concession Framework"
        description="Model concession patterns: decrement sizing, floor protection, and final authority positioning."
      />

      {/* Quick Actions */}
      <PlaceholderCard
        icon={Zap}
        title="Quick Actions"
        description="Generate counteroffer, draft settlement letter, request supervisor authority, or escalate to litigation review."
      />
    </div>
  );
};

function PlaceholderCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
        <h3 className="text-[12px] font-semibold text-foreground">{title}</h3>
        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
          Coming Soon
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

export default NegotiateStrategyPanel;
