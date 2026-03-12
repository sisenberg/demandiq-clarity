/**
 * NegotiateIQ — Center Panel: Strategy generation + display + round management + calibration
 */

import { useState, useMemo, useCallback } from "react";
import type { NegotiationViewModel } from "@/lib/negotiateViewModel";
import type { GeneratedStrategy, StrategyOverride } from "@/types/negotiate-strategy";
import { generateStrategy } from "@/lib/negotiateStrategyEngine";
import { useNegotiateStrategy, useSaveNegotiateStrategy } from "@/hooks/useNegotiateStrategy";
import { useNegotiateSession, useNegotiationRounds, useUpdateSessionAuthority } from "@/hooks/useNegotiateSession";
import { useNegotiateCalibration } from "@/hooks/useNegotiateCalibration";
import NegotiateStrategyCard from "@/components/negotiate/NegotiateStrategyCard";
import RoundManagementPanel from "@/components/negotiate/RoundManagementPanel";
import HistoricalCalibrationCard from "@/components/negotiate/HistoricalCalibrationCard";
import { Zap, RefreshCw } from "lucide-react";

interface NegotiateStrategyPanelProps {
  vm: NegotiationViewModel;
  caseId: string;
  evalPackageId: string;
  attorneyName?: string;
  attorneyFirm?: string;
  jurisdictionState?: string;
}

const NegotiateStrategyPanel = ({ vm, caseId, evalPackageId, attorneyName, attorneyFirm, jurisdictionState }: NegotiateStrategyPanelProps) => {
  const { data: savedStrategy, isLoading } = useNegotiateStrategy(caseId);
  const saveStrategy = useSaveNegotiateStrategy();
  const { data: session } = useNegotiateSession(caseId);
  const { data: rounds = [] } = useNegotiationRounds(session?.id);

  // Calibration
  const { data: calibration, isLoading: calLoading } = useNegotiateCalibration(vm, caseId, {
    attorneyName,
    attorneyFirm,
    jurisdictionState,
    currentCounteroffer: session?.current_counteroffer ?? null,
  });

  // Generate or restore strategy
  const [generatedStrategy, setGeneratedStrategy] = useState<GeneratedStrategy | null>(null);
  const [overrides, setOverrides] = useState<StrategyOverride[]>([]);

  const strategy = useMemo(() => {
    if (savedStrategy && savedStrategy.eval_package_version === vm.provenance.packageVersion) {
      if (!generatedStrategy) {
        setGeneratedStrategy(savedStrategy.generated_strategy);
        setOverrides(savedStrategy.overrides ?? []);
        return savedStrategy.generated_strategy;
      }
    }
    return generatedStrategy;
  }, [savedStrategy, generatedStrategy, vm.provenance.packageVersion]);

  const handleGenerate = useCallback(() => {
    const s = generateStrategy(vm);
    setGeneratedStrategy(s);
    setOverrides([]);
  }, [vm]);

  const handleOverride = useCallback((override: StrategyOverride) => {
    setOverrides((prev) => {
      const filtered = prev.filter((o) => o.field !== override.field);
      return [...filtered, override];
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!strategy) return;
    saveStrategy.mutate({
      caseId,
      evalPackageId,
      evalPackageVersion: vm.provenance.packageVersion,
      generated: strategy,
      overrides,
    });
  }, [strategy, overrides, caseId, evalPackageId, vm.provenance.packageVersion, saveStrategy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No strategy yet — show generate CTA
  if (!strategy) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-12 w-12 rounded-xl bg-[hsl(var(--status-attention))]/10 flex items-center justify-center mb-4">
          <Zap className="h-6 w-6 text-[hsl(var(--status-attention))]" />
        </div>
        <h3 className="text-[14px] font-semibold text-foreground mb-1">Generate Negotiation Strategy</h3>
        <p className="text-[11px] text-muted-foreground max-w-sm leading-relaxed mb-5">
          Generate an initial negotiation plan from EvaluatePackage v{vm.provenance.packageVersion}.
          The strategy engine will recommend positions, movement plans, and tactical actions based on the evaluated range and driver profile.
        </p>
        <button
          onClick={handleGenerate}
          className="flex items-center gap-2 text-[12px] font-semibold px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Zap className="h-4 w-4" />
          Generate Strategy
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Regenerate button */}
      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </button>
      </div>

      <NegotiateStrategyCard
        strategy={strategy}
        overrides={overrides}
        onOverride={handleOverride}
        onSave={handleSave}
        isSaving={saveStrategy.isPending}
        strategyVersion={savedStrategy?.version ?? null}
      />

      {/* Historical Calibration */}
      <HistoricalCalibrationCard calibration={calibration} isLoading={calLoading} />

      {/* Round Management */}
      {session && (
        <RoundManagementPanel
          rounds={rounds}
          sessionId={session.id}
          caseId={caseId}
          strategy={strategy}
          currentCeiling={session.current_authority}
          openingDemand={null}
          vm={vm}
        />
      )}
    </div>
  );
};

export default NegotiateStrategyPanel;
