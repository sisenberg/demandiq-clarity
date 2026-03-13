/**
 * NegotiateIQ — Drafting Engine v1.1
 *
 * Generates editable draft content from case evaluation context,
 * negotiation posture, and adjuster tone selection.
 *
 * Representation-aware: branches language for unrepresented claimants
 * (plain language, non-coercive) vs. attorney-facing (tighter phrasing).
 *
 * Drafting-only — no outbound send capability.
 */

import type { NegotiationViewModel } from "@/lib/negotiateViewModel";
import type { GeneratedStrategy } from "@/types/negotiate-strategy";
import type { NegotiationRoundRow } from "@/types/negotiate-persistence";
import type { ResponseActionType } from "@/lib/negotiateResponseEngine";

// ─── Types ──────────────────────────────────────────────

export type DraftType =
  | "offer_letter"
  | "counteroffer_letter"
  | "excessive_demand_response"
  | "request_support"
  | "counter_review_response"
  | "claim_file_note"
  | "supervisor_escalation"
  | "phone_talking_points";

export type DraftTone = "neutral" | "firm" | "collaborative";

export type DraftAudience = "attorney" | "claimant_direct" | "internal";

export interface DraftInputs {
  draftType: DraftType;
  tone: DraftTone;
  vm: NegotiationViewModel;
  strategy: GeneratedStrategy | null;
  rounds: NegotiationRoundRow[];
  selectedAction?: ResponseActionType;
  proposedOffer?: number | null;
  customInstructions?: string;
  recipientName?: string;
  recipientFirm?: string;
  /** Override audience; auto-detected from vm.representation if omitted */
  audience?: DraftAudience;
}

export interface GeneratedDraft {
  draftType: DraftType;
  tone: DraftTone;
  audience: DraftAudience;
  title: string;
  /** External-facing draft content */
  externalContent: string;
  /** Internal-only rationale / file note */
  internalNotes: string;
  /** Context snippets used in generation */
  contextSnippets: DraftContextSnippet[];
  generatedAt: string;
  engineVersion: string;
}

export interface DraftContextSnippet {
  label: string;
  value: string;
  source: "evaluation" | "strategy" | "round_history" | "risk";
}

// ─── Draft Type Metadata ────────────────────────────────

export const DRAFT_TYPE_META: Record<DraftType, { label: string; description: string; isInternal: boolean }> = {
  offer_letter: { label: "Offer Letter", description: "Formal written offer to claimant counsel", isInternal: false },
  counteroffer_letter: { label: "Counteroffer Letter", description: "Response to claimant's counteroffer with revised position", isInternal: false },
  excessive_demand_response: { label: "Excessive Demand Response", description: "Structured response to an unreasonable demand", isInternal: false },
  request_support: { label: "Request for Records/Support", description: "Request for additional documentation, bills, or records", isInternal: false },
  counter_review_response: { label: "Counter Review Response", description: "'We reviewed your counter' acknowledgment with position", isInternal: false },
  claim_file_note: { label: "Claim File Note", description: "Internal documentation of negotiation activity and rationale", isInternal: true },
  supervisor_escalation: { label: "Supervisor Escalation", description: "Summary for supervisor review or authority request", isInternal: true },
  phone_talking_points: { label: "Phone Talking Points", description: "Structured talking points for verbal negotiation", isInternal: true },
};

const ENGINE_VERSION = "1.1.0";

// ─── Audience Detection ─────────────────────────────────

function resolveAudience(inputs: DraftInputs): DraftAudience {
  if (inputs.audience) return inputs.audience;
  const meta = DRAFT_TYPE_META[inputs.draftType];
  // Internal drafts are always internal, but phone talking points adapt to audience
  if (meta.isInternal && inputs.draftType !== "phone_talking_points") return "internal";
  if (inputs.vm.representation.status === "unrepresented") return "claimant_direct";
  return "attorney";
}

// ─── Engine ─────────────────────────────────────────────

export function generateDraft(inputs: DraftInputs): GeneratedDraft {
  const { draftType, tone, vm, strategy, rounds, selectedAction, proposedOffer, customInstructions, recipientName, recipientFirm } = inputs;
  const audience = resolveAudience(inputs);

  const snippets = buildContextSnippets(vm, strategy, rounds);
  const meta = DRAFT_TYPE_META[draftType];

  const rangeFloor = vm.valuationRange.selectedFloor ?? vm.valuationRange.floor ?? 0;
  const rangeLikely = vm.valuationRange.selectedLikely ?? vm.valuationRange.likely ?? 0;
  const rangeStretch = vm.valuationRange.selectedStretch ?? vm.valuationRange.stretch ?? 0;
  const lastOffer = rounds.length > 0 ? [...rounds].reverse().find(r => r.our_offer != null)?.our_offer : null;
  const lastCounter = rounds.length > 0 ? [...rounds].reverse().find(r => r.their_counteroffer != null)?.their_counteroffer : null;
  const ceiling = strategy?.authorityCeiling.generated ?? null;
  const targetLow = strategy?.targetSettlementZone.generated.low ?? rangeFloor;
  const targetHigh = strategy?.targetSettlementZone.generated.high ?? rangeLikely;
  const offerAmount = proposedOffer ?? lastOffer ?? strategy?.openingOffer.generated ?? rangeFloor;
  const recipient = recipientName || (audience === "claimant_direct" ? "[Claimant Name]" : "[Claimant Counsel]");
  const firm = recipientFirm || "[Firm Name]";

  const toneAdj = tone === "firm" ? "direct and firm" : tone === "collaborative" ? "respectful and collaborative" : "professional and neutral";
  const toneVerb = tone === "firm" ? "maintains" : tone === "collaborative" ? "acknowledges" : "notes";

  const expanderList = vm.expanders.slice(0, 3).map(d => d.label).join(", ") || "N/A";
  const reducerList = vm.reducers.slice(0, 3).map(d => d.label).join(", ") || "N/A";
  const riskList = vm.risks.slice(0, 3).map(r => r.label).join(", ") || "N/A";

  let externalContent = "";
  let internalNotes = "";

  switch (draftType) {
    case "offer_letter":
      externalContent = audience === "claimant_direct"
        ? buildOfferLetterDirect(recipient, offerAmount, vm, customInstructions)
        : buildOfferLetterAttorney(recipient, firm, offerAmount, toneAdj, toneVerb, expanderList, reducerList, vm, customInstructions);
      internalNotes = buildInternalNote("Offer Letter", offerAmount, lastCounter, ceiling, targetLow, targetHigh, selectedAction, strategy, rounds, vm, audience);
      break;

    case "counteroffer_letter":
      externalContent = audience === "claimant_direct"
        ? buildCounterofferLetterDirect(recipient, offerAmount, lastCounter, vm, customInstructions)
        : buildCounterofferLetterAttorney(recipient, firm, offerAmount, lastCounter, toneAdj, toneVerb, expanderList, reducerList, vm, customInstructions);
      internalNotes = buildInternalNote("Counteroffer Letter", offerAmount, lastCounter, ceiling, targetLow, targetHigh, selectedAction, strategy, rounds, vm, audience);
      break;

    case "excessive_demand_response":
      externalContent = audience === "claimant_direct"
        ? buildExcessiveDemandDirect(recipient, lastCounter, offerAmount, vm, customInstructions)
        : buildExcessiveDemandAttorney(recipient, firm, lastCounter, offerAmount, toneAdj, reducerList, riskList, vm, customInstructions);
      internalNotes = buildInternalNote("Excessive Demand Response", offerAmount, lastCounter, ceiling, targetLow, targetHigh, selectedAction, strategy, rounds, vm, audience);
      break;

    case "request_support":
      externalContent = audience === "claimant_direct"
        ? buildRequestSupportDirect(recipient, vm, customInstructions)
        : buildRequestSupportAttorney(recipient, firm, vm, customInstructions);
      internalNotes = `Requesting additional documentation to strengthen defense position. Key gaps: ${riskList}. Current evaluated range: ${fmt(rangeFloor)}–${fmt(rangeStretch)}.`;
      break;

    case "counter_review_response":
      externalContent = audience === "claimant_direct"
        ? buildCounterReviewDirect(recipient, lastCounter, offerAmount, vm, customInstructions)
        : buildCounterReviewAttorney(recipient, firm, lastCounter, offerAmount, toneAdj, toneVerb, vm, customInstructions);
      internalNotes = buildInternalNote("Counter Review Response", offerAmount, lastCounter, ceiling, targetLow, targetHigh, selectedAction, strategy, rounds, vm, audience);
      break;

    case "claim_file_note":
      externalContent = "";
      internalNotes = buildClaimFileNote(offerAmount, lastCounter, ceiling, targetLow, targetHigh, selectedAction, strategy, rounds, vm, expanderList, reducerList, riskList, customInstructions);
      break;

    case "supervisor_escalation":
      externalContent = "";
      internalNotes = buildSupervisorEscalation(offerAmount, lastCounter, ceiling, targetLow, targetHigh, strategy, rounds, vm, expanderList, reducerList, riskList, customInstructions);
      break;

    case "phone_talking_points":
      externalContent = buildPhoneTalkingPoints(offerAmount, lastCounter, toneAdj, expanderList, reducerList, vm, strategy, audience, customInstructions);
      internalNotes = `Phone talking points generated for ${tone} tone (${audience === "claimant_direct" ? "direct claimant" : "attorney"} audience). Proposed position: ${fmt(offerAmount)}. Do not deviate from approved authority of ${ceiling ? fmt(ceiling) : "TBD"}.`;
      break;
  }

  return {
    draftType,
    tone,
    audience,
    title: meta.label,
    externalContent,
    internalNotes,
    contextSnippets: snippets,
    generatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
  };
}

// ═══════════════════════════════════════════════════════
// CLAIMANT DIRECT (UNREPRESENTED) DRAFTS
// Plain language, non-coercive, explanatory
// ═══════════════════════════════════════════════════════

function buildOfferLetterDirect(recipient: string, offer: number, vm: NegotiationViewModel, custom?: string): string {
  return `Dear ${recipient},

Thank you for filing your claim. We have completed our review of the medical records and documentation you provided.

After carefully reviewing the details of your claim, including your medical treatment and how the incident occurred, we would like to offer ${fmt(offer)} to resolve this matter.

Here is how we arrived at this amount:

• We reviewed the medical bills and treatment records you submitted.${vm.specials.reductionPercent != null && vm.specials.reductionPercent > 0 ? `\n• After comparing the charges to standard rates for similar treatment, we adjusted the medical costs, which is a standard part of our review process.` : ""}
• We considered the nature and extent of your injuries as documented by your medical providers.
• We took into account all the information available about how the incident occurred.

What this means for you:
• This offer represents what we believe is a fair amount based on the documented evidence.
• You are not required to accept this offer. You have the right to negotiate, seek legal advice, or pursue other options.
• If you have questions about how we reached this amount, we are happy to explain further.

Please take the time you need to consider this offer. If you would like to discuss it, you can reach us at the contact information below.${custom ? `\n\n${custom}` : ""}

Sincerely,
[Adjuster Name]
[Company Name]
[Phone Number]`;
}

function buildCounterofferLetterDirect(recipient: string, offer: number, lastCounter: number | null, vm: NegotiationViewModel, custom?: string): string {
  return `Dear ${recipient},

Thank you for your response${lastCounter ? ` and for sharing that you believe the claim is worth ${fmt(lastCounter)}` : ""}. We appreciate you taking the time to explain your position.

After reviewing your response and reconsidering the information available, we are prepared to increase our offer to ${fmt(offer)}.

This revised amount reflects:
• Our continued review of your medical treatment and documentation
• The factors that support the value of your claim
• A fair assessment based on the evidence we have reviewed

We want to make sure you understand:
• You are not required to accept this revised offer.
• You are welcome to respond with your own thoughts on a fair amount.
• You have the right to consult with an attorney at any time if you wish.

We are committed to reaching a fair resolution and welcome further discussion.${custom ? `\n\n${custom}` : ""}

Sincerely,
[Adjuster Name]
[Company Name]
[Phone Number]`;
}

function buildExcessiveDemandDirect(recipient: string, lastCounter: number | null, offer: number, vm: NegotiationViewModel, custom?: string): string {
  return `Dear ${recipient},

Thank you for letting us know what you believe your claim is worth${lastCounter ? ` (${fmt(lastCounter)})` : ""}. We understand that dealing with an injury can be stressful, and we want to work with you toward a fair resolution.

After reviewing all of the documentation, we believe the amount you have requested is higher than what the evidence supports. Here is why:

• The medical records show specific treatments and costs, and we have compared these to standard rates for similar care.
• Some of the charges may exceed what is typically considered reasonable for the type of treatment received.
• We have considered all the circumstances of the incident in our evaluation.

Based on our review, our current position is ${fmt(offer)}. We believe this reflects a fair assessment of your claim based on the documented evidence.

What you can do:
• If you have additional medical records or documentation that we have not yet reviewed, please send them to us. Additional information may affect our evaluation.
• You are welcome to share your thoughts on why you believe a different amount is appropriate.
• You have the right to consult with an attorney at any time.

We remain committed to resolving this matter fairly.${custom ? `\n\n${custom}` : ""}

Sincerely,
[Adjuster Name]
[Company Name]
[Phone Number]`;
}

function buildRequestSupportDirect(recipient: string, vm: NegotiationViewModel, custom?: string): string {
  const gaps = vm.risks.filter(r => r.category === "gap" || r.category === "treatment" || r.category === "causation");
  return `Dear ${recipient},

To help us evaluate your claim as fairly and completely as possible, we need some additional information from you. Having complete records helps us ensure you receive a fair offer.

Here is what we need:

• Updated medical records from all of your doctors and treatment providers
• Itemized bills showing the specific treatments and their costs
• If you missed work because of your injury, documentation from your employer showing the time missed and any lost wages
• Any recent test results (X-rays, MRIs, etc.) that we may not have received yet
${gaps.length > 0 ? `\nSpecifically, we noticed the following gaps in the information we have:\n${gaps.map(g => `• ${g.label}: ${g.description}`).join("\n")}` : ""}

Why this matters:
Complete documentation helps us make the most accurate assessment of your claim. Without it, we can only evaluate based on what is currently available.

If you need help obtaining these records, please let us know and we can discuss options.${custom ? `\n\n${custom}` : ""}

Thank you for your cooperation.

Sincerely,
[Adjuster Name]
[Company Name]
[Phone Number]`;
}

function buildCounterReviewDirect(recipient: string, lastCounter: number | null, offer: number, vm: NegotiationViewModel, custom?: string): string {
  return `Dear ${recipient},

Thank you for your recent response${lastCounter ? ` and for sharing your position of ${fmt(lastCounter)}` : ""}. We have taken the time to carefully review what you have shared.

After consideration, we are prepared to ${offer > (lastCounter ?? 0) ? "maintain" : "adjust"} our position to ${fmt(offer)}.

This amount is based on:
• A thorough review of your medical records and treatment
• A comparison of the charges to standard rates for similar care
• Consideration of all the circumstances of your claim

As always, you have the right to:
• Continue discussing the amount with us
• Provide additional documentation that may affect our evaluation
• Seek legal advice at any time

We are here to help reach a fair resolution.${custom ? `\n\n${custom}` : ""}

Sincerely,
[Adjuster Name]
[Company Name]
[Phone Number]`;
}

// ═══════════════════════════════════════════════════════
// ATTORNEY-FACING DRAFTS
// Professional, tighter negotiation phrasing
// ═══════════════════════════════════════════════════════

function buildOfferLetterAttorney(recipient: string, firm: string, offer: number, toneAdj: string, toneVerb: string, expanders: string, reducers: string, vm: NegotiationViewModel, custom?: string): string {
  return `Dear ${recipient},

Thank you for providing the demand package on behalf of your client. We have completed a thorough review of the submitted medical records, billing documentation, and supporting materials.

After careful evaluation of the claimed injuries, treatment history, and applicable liability considerations, we are prepared to extend an initial offer of ${fmt(offer)} to resolve this matter.

This offer reflects our analysis of the following factors:

• Medical treatment review: We have evaluated the submitted medical records and billing. ${vm.specials.reductionPercent != null && vm.specials.reductionPercent > 0 ? `Our review identified a ${vm.specials.reductionPercent}% adjustment from billed to reviewed medical specials, reflecting standard reasonableness analysis.` : "The submitted medical documentation has been considered in full."}

• Valuation drivers considered: ${expanders}

• Factors tempering value: ${reducers}

This offer ${toneVerb} the documented treatment and represents a ${toneAdj} assessment of the claim's settlement value under the applicable policy.

We welcome the opportunity to discuss this matter further and reach a resolution that is fair to all parties.${custom ? `\n\n${custom}` : ""}

Please do not hesitate to contact us with any questions.

Sincerely,
[Adjuster Name]
[Company Name]`;
}

function buildCounterofferLetterAttorney(recipient: string, firm: string, offer: number, lastCounter: number | null, toneAdj: string, toneVerb: string, expanders: string, reducers: string, vm: NegotiationViewModel, custom?: string): string {
  return `Dear ${recipient},

Thank you for your response${lastCounter ? ` and your revised demand of ${fmt(lastCounter)}` : ""}. We have carefully considered your position and the supporting documentation provided.

After further review, we are prepared to revise our position to ${fmt(offer)}.

This revised offer reflects:

• Our continued assessment of the documented medical treatment and its relationship to the claimed injuries
• Consideration of applicable treatment reasonableness and medical necessity factors
• The valuation drivers identified in our evaluation: ${expanders}
• The tempering factors applicable to this claim: ${reducers}
${vm.specials.reductionPercent != null && vm.specials.reductionPercent > 0 ? `• A ${vm.specials.reductionPercent}% adjustment applied to medical specials based on reasonableness review` : ""}

This position ${toneVerb} the treatment documented in the record and represents a ${toneAdj} assessment of the claim's fair resolution value.

We remain interested in reaching a fair resolution and look forward to your response.${custom ? `\n\n${custom}` : ""}

Sincerely,
[Adjuster Name]
[Company Name]`;
}

function buildExcessiveDemandAttorney(recipient: string, firm: string, lastCounter: number | null, offer: number, toneAdj: string, reducers: string, risks: string, vm: NegotiationViewModel, custom?: string): string {
  return `Dear ${recipient},

We have received and reviewed your demand${lastCounter ? ` of ${fmt(lastCounter)}` : ""}. While we appreciate the opportunity to evaluate the claim, we believe the demand significantly exceeds the supportable value of this matter based on the documented evidence.

Specifically, our review has identified the following concerns:

• ${reducers.split(", ").map(r => `${r}`).join("\n• ")}
${risks !== "N/A" ? `• Risk factors: ${risks}` : ""}
${vm.specials.reductionPercent != null && vm.specials.reductionPercent > 25 ? `• Medical specials reflect a substantial ${vm.specials.reductionPercent}% reduction upon reasonableness review` : ""}

Given these factors, we are unable to approach the demanded amount. Our current position of ${fmt(offer)} reflects a ${toneAdj} assessment based on the documented medical treatment, applicable liability considerations, and standard valuation methodology.

We encourage a more realistic reassessment of the claim's value and remain open to continued negotiation.${custom ? `\n\n${custom}` : ""}

Sincerely,
[Adjuster Name]
[Company Name]`;
}

function buildRequestSupportAttorney(recipient: string, firm: string, vm: NegotiationViewModel, custom?: string): string {
  const gaps = vm.risks.filter(r => r.category === "gap" || r.category === "treatment" || r.category === "causation");
  return `Dear ${recipient},

In connection with our ongoing evaluation of this claim, we are requesting the following additional documentation to assist in reaching a fair resolution:

• Updated medical records from all treating providers, including any records post-dating the most recent submission
• Itemized billing statements with CPT codes for all claimed treatment
• Documentation supporting claimed wage loss, if applicable
• Any additional diagnostic imaging reports not previously submitted
${gaps.length > 0 ? `\nSpecifically, our review has identified the following areas requiring additional documentation:\n${gaps.map(g => `• ${g.label}: ${g.description}`).join("\n")}` : ""}

Providing complete and current documentation will assist both parties in reaching a well-informed resolution.${custom ? `\n\n${custom}` : ""}

Thank you for your cooperation.

Sincerely,
[Adjuster Name]
[Company Name]`;
}

function buildCounterReviewAttorney(recipient: string, firm: string, lastCounter: number | null, offer: number, toneAdj: string, toneVerb: string, vm: NegotiationViewModel, custom?: string): string {
  return `Dear ${recipient},

Thank you for your recent correspondence${lastCounter ? ` and your revised position of ${fmt(lastCounter)}` : ""}. We have completed our review of the updated position and supporting rationale.

After consideration, we ${toneVerb} the following:

• The medical documentation has been reviewed against applicable treatment guidelines
• The claimed specials have been evaluated for reasonableness and medical necessity
• Applicable liability and damages factors have been weighed

Based on this review, we are prepared to ${offer > (lastCounter ?? 0) ? "maintain" : "revise"} our position to ${fmt(offer)}.

We remain committed to reaching a fair resolution and welcome further discussion.${custom ? `\n\n${custom}` : ""}

Sincerely,
[Adjuster Name]
[Company Name]`;
}

// ═══════════════════════════════════════════════════════
// PHONE TALKING POINTS (audience-branched)
// ═══════════════════════════════════════════════════════

function buildPhoneTalkingPoints(offer: number, lastCounter: number | null, toneAdj: string, expanders: string, reducers: string, vm: NegotiationViewModel, strategy: GeneratedStrategy | null, audience: DraftAudience, custom?: string): string {
  const ceiling = strategy?.authorityCeiling.generated;
  const walkAway = strategy?.walkAwayThreshold.generated;
  const isDirect = audience === "claimant_direct";

  return `PHONE TALKING POINTS — CONFIDENTIAL

─── OPENING ────────────────────────────────
• ${isDirect ? "Thank the claimant for their time; use simple, clear language" : "Thank counsel for their time"}
• Reference the ongoing ${isDirect ? "claim" : "negotiation"} and acknowledge the ${isDirect ? "claimant's situation" : "claim"}
• Tone: ${toneAdj}
${isDirect ? "• REMINDER: Claimant is unrepresented. Use plain language. Do not use legal jargon. Do not pressure or create urgency." : ""}

─── CURRENT POSITION ──────────────────────
• Our current offer: ${fmt(offer)}
${lastCounter ? `• Their last ${isDirect ? "request" : "counter"}: ${fmt(lastCounter)}` : `• No ${isDirect ? "response" : "counteroffer"} received yet`}
• Gap: ${lastCounter ? fmt(lastCounter - offer) : "N/A"}

─── KEY POINTS TO MAKE ────────────────────
${isDirect ? `• Explain clearly how the offer was determined based on the medical evidence
• "We reviewed your medical records and treatment, and this offer reflects the documented care you received"
• If asked about specials adjustments: "We compared the charges to standard rates for similar treatment in your area"
• Value supported by: ${expanders}
• Value considerations: ${reducers}` : `• Medical review supports ${vm.specials.totalReviewed != null ? fmt(vm.specials.totalReviewed) : "reviewed amount"} in reasonable specials
${vm.specials.reductionPercent != null && vm.specials.reductionPercent > 0 ? `• ${vm.specials.reductionPercent}% reduction from billed to reviewed is supported by treatment analysis` : ""}
• Value supported by: ${expanders}
• Value constrained by: ${reducers}`}

─── BOUNDARIES (DO NOT SHARE) ─────────────
${ceiling ? `• Authority ceiling: ${fmt(ceiling)} — DO NOT EXCEED` : "• Authority ceiling: Not set"}
${walkAway ? `• Walk-away threshold: ${fmt(walkAway)}` : ""}
• Target zone: ${strategy ? `${fmt(strategy.targetSettlementZone.generated.low)}–${fmt(strategy.targetSettlementZone.generated.high)}` : "Not set"}

─── IF THEY PUSH BACK ─────────────────────
${isDirect ? `• "I understand this may be less than you expected. Let me explain how we arrived at this number."
• Offer to walk through the medical review findings
• Remind them: "You have the right to consult with an attorney if you wish"
• Do NOT pressure them to accept or imply the offer is take-it-or-leave-it
• Do NOT suggest the amount is lower because they don't have an attorney` : `• Reiterate that our position is based on documented medical evidence
• Reference specific treatment concerns if applicable
• Avoid committing to movement without reviewing authority
• Do not discuss internal valuation methodology`}

─── CLOSING ───────────────────────────────
• Summarize any agreement or next steps
• Confirm timeline for response if no agreement reached
${isDirect ? "• Remind them they can take time to consider and are welcome to call back with questions" : ""}
• Document the conversation immediately after the call${custom ? `\n\n─── CUSTOM NOTES ──────────────────────────\n${custom}` : ""}`;
}

// ─── Internal Note Builders ─────────────────────────────

function buildInternalNote(context: string, offer: number, lastCounter: number | null, ceiling: number | null, targetLow: number, targetHigh: number, selectedAction: ResponseActionType | undefined, strategy: GeneratedStrategy | null, rounds: NegotiationRoundRow[], vm: NegotiationViewModel, audience: DraftAudience): string {
  const parts: string[] = [];
  parts.push(`INTERNAL NOTE — ${context.toUpperCase()}`);
  parts.push(`Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
  parts.push(`Audience: ${audience === "claimant_direct" ? "Direct Claimant (Unrepresented)" : audience === "attorney" ? "Attorney" : "Internal"}`);
  parts.push(`Representation Status: ${vm.representation.status}`);
  parts.push("");
  parts.push(`Current Position: ${fmt(offer)}`);
  if (lastCounter) parts.push(`Last Counteroffer: ${fmt(lastCounter)}`);
  parts.push(`Gap: ${lastCounter ? fmt(lastCounter - offer) : "N/A"}`);
  parts.push(`Round: ${rounds.length}`);
  parts.push("");
  parts.push(`Target Zone: ${fmt(targetLow)}–${fmt(targetHigh)}`);
  if (ceiling) parts.push(`Authority Ceiling: ${fmt(ceiling)}`);
  if (strategy?.walkAwayThreshold) parts.push(`Walk-Away: ${fmt(strategy.walkAwayThreshold.generated)}`);
  parts.push("");
  if (selectedAction) parts.push(`Selected Action: ${selectedAction}`);
  parts.push(`Concession Posture: ${strategy?.concessionPosture.generated ?? "N/A"}`);
  if (strategy?.representationPosture) {
    parts.push(`Representation Posture: ${strategy.representationPosture.generated}`);
  }
  parts.push("");
  parts.push(`EvaluatePackage v${vm.provenance.packageVersion} (${vm.provenance.sourceModule} v${vm.provenance.sourcePackageVersion})`);
  parts.push(`Valuation Confidence: ${vm.valuationRange.confidence != null ? Math.round(vm.valuationRange.confidence * 100) + "%" : "N/A"}`);
  if (vm.specials.reductionPercent != null) parts.push(`Medical Specials Reduction: ${vm.specials.reductionPercent}%`);
  parts.push("");
  parts.push("NOTE: Representation status did not directly reduce fact-based case value.");
  return parts.join("\n");
}

function buildClaimFileNote(offer: number, lastCounter: number | null, ceiling: number | null, targetLow: number, targetHigh: number, selectedAction: ResponseActionType | undefined, strategy: GeneratedStrategy | null, rounds: NegotiationRoundRow[], vm: NegotiationViewModel, expanders: string, reducers: string, risks: string, custom?: string): string {
  const parts: string[] = [];
  parts.push("CLAIM FILE NOTE — NEGOTIATION ACTIVITY");
  parts.push(`Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
  parts.push(`Round: ${rounds.length}`);
  parts.push(`Representation: ${vm.representation.status}${vm.representation.transitioned ? " (transitioned during claim)" : ""}`);
  parts.push("");
  parts.push("── CURRENT POSTURE ──");
  parts.push(`Our Offer: ${fmt(offer)}`);
  if (lastCounter) parts.push(`Their Counter: ${fmt(lastCounter)} (gap: ${fmt(lastCounter - offer)})`);
  parts.push(`Target Zone: ${fmt(targetLow)}–${fmt(targetHigh)}`);
  if (ceiling) parts.push(`Authority: ${fmt(ceiling)}`);
  parts.push(`Posture: ${strategy?.concessionPosture.generated ?? "N/A"}`);
  if (strategy?.representationPosture) parts.push(`Representation Posture: ${strategy.representationPosture.generated}`);
  if (selectedAction) parts.push(`Action Taken: ${selectedAction}`);
  parts.push("");
  parts.push("── VALUATION BASIS ──");
  parts.push(`EvaluatePackage v${vm.provenance.packageVersion}`);
  parts.push(`Evaluated Range: ${fmt(vm.valuationRange.floor ?? 0)}–${fmt(vm.valuationRange.stretch ?? 0)}`);
  parts.push(`Expanders: ${expanders}`);
  parts.push(`Reducers: ${reducers}`);
  parts.push(`Risks: ${risks}`);
  if (vm.specials.reductionPercent != null) parts.push(`Specials Reduction: ${vm.specials.reductionPercent}%`);
  parts.push("");
  parts.push("── COMPLIANCE ──");
  parts.push("Representation status did not directly reduce fact-based case value.");
  parts.push("");
  parts.push("── ROUND HISTORY ──");
  for (const r of rounds) {
    parts.push(`  Rd ${r.round_number}: Our ${r.our_offer != null ? fmt(r.our_offer) : "—"} / Their ${r.their_counteroffer != null ? fmt(r.their_counteroffer) : "—"}`);
  }
  if (custom) { parts.push(""); parts.push(`── NOTES ──\n${custom}`); }
  return parts.join("\n");
}

function buildSupervisorEscalation(offer: number, lastCounter: number | null, ceiling: number | null, targetLow: number, targetHigh: number, strategy: GeneratedStrategy | null, rounds: NegotiationRoundRow[], vm: NegotiationViewModel, expanders: string, reducers: string, risks: string, custom?: string): string {
  const parts: string[] = [];
  parts.push("SUPERVISOR ESCALATION SUMMARY");
  parts.push(`Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
  parts.push(`Representation: ${vm.representation.status}${vm.representation.transitioned ? " (transitioned during claim)" : ""}`);
  parts.push("");
  parts.push("── REQUEST ──");
  parts.push(ceiling ? `Current authority: ${fmt(ceiling)}` : "No authority ceiling set.");
  parts.push(`Current offer: ${fmt(offer)}`);
  if (lastCounter) parts.push(`Claimant counter: ${fmt(lastCounter)}`);
  parts.push(`Rounds completed: ${rounds.length}`);
  parts.push("");
  parts.push("── EVALUATION SUMMARY ──");
  parts.push(`Evaluated Range: ${fmt(vm.valuationRange.floor ?? 0)} (floor) / ${fmt(vm.valuationRange.likely ?? 0)} (likely) / ${fmt(vm.valuationRange.stretch ?? 0)} (stretch)`);
  parts.push(`Target Settlement Zone: ${fmt(targetLow)}–${fmt(targetHigh)}`);
  parts.push(`Confidence: ${vm.valuationRange.confidence != null ? Math.round(vm.valuationRange.confidence * 100) + "%" : "N/A"}`);
  parts.push(`Source: EvaluatePackage v${vm.provenance.packageVersion} from ${vm.provenance.sourceModule} v${vm.provenance.sourcePackageVersion}`);
  parts.push("");
  parts.push("── KEY DRIVERS ──");
  parts.push(`Expanding value: ${expanders}`);
  parts.push(`Reducing value: ${reducers}`);
  parts.push(`Risk factors: ${risks}`);
  if (vm.specials.reductionPercent != null) parts.push(`Medical specials reduction: ${vm.specials.reductionPercent}%`);
  parts.push("");
  parts.push("── NEGOTIATION HISTORY ──");
  for (const r of rounds) {
    parts.push(`  Round ${r.round_number}: Defense ${r.our_offer != null ? fmt(r.our_offer) : "—"} / Claimant ${r.their_counteroffer != null ? fmt(r.their_counteroffer) : "—"}`);
  }
  parts.push("");
  parts.push("── RECOMMENDATION ──");
  parts.push(strategy?.rationaleSummary ?? "No strategy rationale available.");
  parts.push("");
  parts.push("── COMPLIANCE NOTE ──");
  parts.push("Representation status did not directly reduce fact-based case value.");
  if (custom) { parts.push(""); parts.push(`── ADDITIONAL CONTEXT ──\n${custom}`); }
  return parts.join("\n");
}

// ─── Context Snippets ───────────────────────────────────

function buildContextSnippets(vm: NegotiationViewModel, strategy: GeneratedStrategy | null, rounds: NegotiationRoundRow[]): DraftContextSnippet[] {
  const snippets: DraftContextSnippet[] = [];

  snippets.push({
    label: "Evaluated Range",
    value: `Floor: ${fmt(vm.valuationRange.floor ?? 0)} · Likely: ${fmt(vm.valuationRange.likely ?? 0)} · Stretch: ${fmt(vm.valuationRange.stretch ?? 0)}`,
    source: "evaluation",
  });

  if (vm.specials.totalBilled > 0) {
    snippets.push({
      label: "Medical Specials",
      value: `Billed: ${fmt(vm.specials.totalBilled)}${vm.specials.totalReviewed != null ? ` · Reviewed: ${fmt(vm.specials.totalReviewed)}` : ""}${vm.specials.reductionPercent != null ? ` · ${vm.specials.reductionPercent}% reduction` : ""}`,
      source: "evaluation",
    });
  }

  if (strategy) {
    snippets.push({
      label: "Target Zone",
      value: `${fmt(strategy.targetSettlementZone.generated.low)}–${fmt(strategy.targetSettlementZone.generated.high)}`,
      source: "strategy",
    });
    snippets.push({
      label: "Authority Ceiling",
      value: fmt(strategy.authorityCeiling.generated),
      source: "strategy",
    });
    snippets.push({
      label: "Concession Posture",
      value: `${strategy.concessionPosture.generated} — ${strategy.concessionPosture.reason}`,
      source: "strategy",
    });
    snippets.push({
      label: "Representation Posture",
      value: `${strategy.representationPosture.generated} — ${strategy.representationPosture.reason}`,
      source: "strategy",
    });
  }

  for (const d of vm.expanders.slice(0, 3)) {
    snippets.push({ label: `Expander: ${d.label}`, value: d.description, source: "evaluation" });
  }
  for (const d of vm.reducers.slice(0, 3)) {
    snippets.push({ label: `Reducer: ${d.label}`, value: d.description, source: "evaluation" });
  }
  for (const r of vm.risks.slice(0, 3)) {
    snippets.push({ label: `Risk: ${r.label}`, value: r.description, source: "risk" });
  }

  if (rounds.length > 0) {
    const last = rounds[rounds.length - 1];
    snippets.push({
      label: "Latest Round",
      value: `Round ${last.round_number}: Our ${last.our_offer != null ? fmt(last.our_offer) : "—"} / Their ${last.their_counteroffer != null ? fmt(last.their_counteroffer) : "—"}`,
      source: "round_history",
    });
  }

  return snippets;
}

// ─── Helper ─────────────────────────────────────────────

function fmt(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}
