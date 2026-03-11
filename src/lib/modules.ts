// ===================================================
// CasualtyIQ — Module Registry & Feature Flags
// ===================================================

export interface ModuleDefinition {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  /** DemandIQ is the base module included with every tenant */
  isBase: boolean;
  icon: string; // lucide icon name
  accentHsl: string; // HSL variable reference
}

export const MODULES: ModuleDefinition[] = [
  {
    id: "demandiq",
    label: "DemandIQ",
    shortLabel: "Demand",
    description: "Document intake, chronology, issue flagging & demand package generation",
    enabled: true,
    comingSoon: false,
    icon: "FileText",
    accentHsl: "var(--primary)",
  },
  {
    id: "revieweriq",
    label: "ReviewerIQ",
    shortLabel: "Reviewer",
    description: "Medical reasonableness & necessity review using AMA guidelines and Medicare rules",
    enabled: false,
    comingSoon: true,
    icon: "Stethoscope",
    accentHsl: "var(--status-review)",
  },
  {
    id: "evaluateiq",
    label: "EvaluateIQ",
    shortLabel: "Evaluate",
    description: "Valuation modeling and settlement range analysis",
    enabled: false,
    comingSoon: true,
    icon: "Calculator",
    accentHsl: "var(--status-approved)",
  },
  {
    id: "negotiateiq",
    label: "NegotiateIQ",
    shortLabel: "Negotiate",
    description: "Negotiation strategy, offer drafting & counteroffers",
    enabled: false,
    comingSoon: true,
    icon: "Handshake",
    accentHsl: "var(--status-attention)",
  },
  {
    id: "litiq",
    label: "LitIQ",
    shortLabel: "Lit",
    description: "Litigation-stage follow-through and case management",
    enabled: false,
    comingSoon: true,
    icon: "Scale",
    accentHsl: "var(--status-failed)",
  },
];

export function getModule(id: string): ModuleDefinition | undefined {
  return MODULES.find((m) => m.id === id);
}

export function getActiveModules(): ModuleDefinition[] {
  return MODULES.filter((m) => m.enabled);
}

export function isModuleEnabled(id: string): boolean {
  return MODULES.find((m) => m.id === id)?.enabled ?? false;
}
