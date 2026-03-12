/**
 * NegotiateIQ — Strategy Types
 *
 * Typed contracts for the strategy engine output, human overrides,
 * and persistence.
 */

// ─── Concession Posture ─────────────────────────────────

export type ConcessionPosture = "conservative" | "standard" | "flexible";

// ─── Recommendation with Reason ─────────────────────────

export interface StrategyRecommendation<T = number> {
  /** Engine-generated value */
  generated: T;
  /** Short reason string explaining the recommendation */
  reason: string;
}

// ─── Movement Plan ──────────────────────────────────────

export interface MovementPlan {
  firstMove: StrategyRecommendation<number>;
  midRoundMove: StrategyRecommendation<number>;
  endgameMove: StrategyRecommendation<number>;
}

// ─── Tactical Recommendations ───────────────────────────

export interface TacticalRecommendation {
  type: "bracket" | "hold" | "request_support";
  recommended: boolean;
  reason: string;
}

// ─── Generated Strategy ─────────────────────────────────

export interface GeneratedStrategy {
  engineVersion: string;
  generatedAt: string;
  evalPackageVersion: number;

  openingOffer: StrategyRecommendation;
  authorityCeiling: StrategyRecommendation;
  targetSettlementZone: StrategyRecommendation<{ low: number; high: number }>;
  walkAwayThreshold: StrategyRecommendation;

  concessionPosture: StrategyRecommendation<ConcessionPosture>;
  movementPlan: MovementPlan;

  tacticalRecommendations: TacticalRecommendation[];

  /** Top driver keys that shaped the strategy */
  keyDrivers: string[];
  rationaleSummary: string;
}

// ─── Human Override ─────────────────────────────────────

export interface StrategyOverride {
  field: OverridableField;
  originalValue: unknown;
  overrideValue: unknown;
  reason: string;
  overriddenBy: string | null;
  overriddenAt: string;
}

export type OverridableField =
  | "openingOffer"
  | "authorityCeiling"
  | "targetSettlementZone"
  | "walkAwayThreshold"
  | "concessionPosture";

// ─── Persisted Strategy ─────────────────────────────────

export interface PersistedStrategy {
  id: string;
  caseId: string;
  tenantId: string;
  evalPackageId: string;
  evalPackageVersion: number;
  generated: GeneratedStrategy;
  overrides: StrategyOverride[];
  version: number;
  createdAt: string;
  createdBy: string | null;
}
