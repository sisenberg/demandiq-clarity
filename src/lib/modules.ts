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
    description: "Document intake, chronology, issue flagging & demand completion",
    isBase: true,
    icon: "FileText",
    accentHsl: "var(--primary)",
  },
  {
    id: "revieweriq",
    label: "ReviewerIQ",
    shortLabel: "Reviewer",
    description: "Medical reasonableness & necessity review using AMA guidelines and Medicare rules",
    isBase: false,
    icon: "Stethoscope",
    accentHsl: "var(--status-review)",
  },
  {
    id: "evaluateiq",
    label: "EvaluateIQ",
    shortLabel: "Evaluate",
    description: "Valuation modeling and settlement range analysis",
    isBase: false,
    icon: "Calculator",
    accentHsl: "var(--status-approved)",
  },
  {
    id: "negotiateiq",
    label: "NegotiateIQ",
    shortLabel: "Negotiate",
    description: "Negotiation strategy, offer drafting & counteroffers",
    isBase: false,
    icon: "Handshake",
    accentHsl: "var(--status-attention)",
  },
  {
    id: "litiq",
    label: "LitIQ",
    shortLabel: "Lit",
    description: "Litigation-stage follow-through and case management",
    isBase: false,
    icon: "Scale",
    accentHsl: "var(--status-failed)",
  },
];

export function getModule(id: string): ModuleDefinition | undefined {
  return MODULES.find((m) => m.id === id);
}

/** Returns modules the tenant has licensed */
export function getTenantModules(enabledIds: string[]): ModuleDefinition[] {
  return MODULES.filter((m) => enabledIds.includes(m.id));
}

/** Returns add-on modules the tenant has NOT licensed */
export function getLockedModules(enabledIds: string[]): ModuleDefinition[] {
  return MODULES.filter((m) => !m.isBase && !enabledIds.includes(m.id));
}

export function isModuleEnabled(enabledIds: string[], id: string): boolean {
  return enabledIds.includes(id);
}
