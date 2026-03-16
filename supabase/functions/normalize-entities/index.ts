import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * normalize-entities: Cross-document entity clustering.
 *
 * Reads all document_metadata_extractions for a case, groups them by
 * entity type, uses AI to identify likely matches, and persists
 * entity_clusters + entity_cluster_members.
 *
 * Input: { case_id: string }
 */

// Map extraction field_types to entity_types
const FIELD_TO_ENTITY: Record<string, string> = {
  claimant_name: "claimant",
  attorney_name: "attorney",
  law_firm: "law_firm",
  provider_name: "provider",
  facility_name: "facility",
  claim_number: "claim_number",
  // insurer/carrier detected from insurance_document types
};

const ENTITY_TYPES = ["claimant", "attorney", "law_firm", "provider", "facility", "claim_number", "insurer"];

// COMPLIANCE NOTE: This function sends extracted PII (names, identifiers) to
// the Lovable AI Gateway for entity clustering. See docs/compliance/subprocessor-boundaries.md.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !lovableApiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { case_id } = await req.json();

    if (!case_id) {
      return new Response(
        JSON.stringify({ error: "case_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get case to verify + get tenant_id
    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .select("id, tenant_id")
      .eq("id", case_id)
      .single();

    if (caseErr || !caseRow) {
      return new Response(
        JSON.stringify({ error: `Case not found: ${caseErr?.message}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = caseRow.tenant_id;

    // 2. Fetch all metadata extractions for the case
    const { data: extractions, error: extErr } = await supabase
      .from("document_metadata_extractions")
      .select("*")
      .eq("case_id", case_id)
      .order("confidence", { ascending: false });

    if (extErr) throw new Error(`Failed to fetch extractions: ${extErr.message}`);

    if (!extractions || extractions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No extractions to normalize", clusters_created: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Group extractions by entity type
    const byEntityType: Record<string, Array<{
      id: string;
      value: string;
      confidence: number;
      document_id: string;
      source_page: number | null;
      source_snippet: string;
    }>> = {};

    for (const ext of extractions) {
      const entityType = FIELD_TO_ENTITY[ext.field_type];
      if (!entityType) continue;

      const effectiveValue = ext.user_corrected_value || ext.extracted_value;
      if (!effectiveValue?.trim()) continue;

      if (!byEntityType[entityType]) byEntityType[entityType] = [];
      byEntityType[entityType].push({
        id: ext.id,
        value: effectiveValue.trim(),
        confidence: ext.confidence ?? 0.5,
        document_id: ext.document_id,
        source_page: ext.source_page,
        source_snippet: ext.source_snippet || "",
      });
    }

    // 4. Use AI to cluster entities for types with >1 candidate
    const clusterResults: Array<{
      entity_type: string;
      clusters: Array<{
        display_value: string;
        confidence: number;
        is_primary: boolean;
        member_indices: number[];
      }>;
    }> = [];

    // For types with only 1 unique value, skip AI
    for (const [entityType, items] of Object.entries(byEntityType)) {
      const uniqueValues = [...new Set(items.map((i) => i.value.toLowerCase()))];

      if (uniqueValues.length <= 1) {
        // Single cluster, no AI needed
        clusterResults.push({
          entity_type: entityType,
          clusters: [{
            display_value: items[0].value,
            confidence: Math.max(...items.map((i) => i.confidence)),
            is_primary: true,
            member_indices: items.map((_, idx) => idx),
          }],
        });
        continue;
      }

      // Multiple unique values - use AI to cluster
      // COMPLIANCE: item.value contains PII (names, identifiers). This is sent to AI
      // for entity resolution — an approved AI boundary path. Do NOT log item values.
      const itemList = items.map((item, idx) =>
        `[${idx}] "${item.value}" (confidence: ${item.confidence.toFixed(2)}, doc: ${item.document_id.slice(0, 8)})`
      ).join("\n");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a legal entity resolution specialist for personal injury claims. You cluster name variants that refer to the same real-world entity. Be conservative: only merge when clearly the same entity (e.g., "Dr. Smith" and "John Smith, MD" and "Smith, J." for a provider). Keep separate when uncertain. For each cluster, pick the most complete/formal name as the display_value.`,
            },
            {
              role: "user",
              content: `Cluster these ${entityType} references into groups of the same real-world entity. Each item has an index [N].\n\n${itemList}\n\nGroup items that refer to the same entity. Mark the most likely primary/canonical entity.`,
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "cluster_entities",
              description: "Group entity references into clusters of the same real-world entity.",
              parameters: {
                type: "object",
                properties: {
                  clusters: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        display_value: {
                          type: "string",
                          description: "The best canonical name for this entity",
                        },
                        confidence: {
                          type: "number",
                          description: "Confidence that all members are the same entity (0-1)",
                        },
                        is_primary: {
                          type: "boolean",
                          description: "Whether this is likely the primary/main entity of this type for the case",
                        },
                        member_indices: {
                          type: "array",
                          items: { type: "integer" },
                          description: "Indices of items belonging to this cluster",
                        },
                      },
                      required: ["display_value", "confidence", "is_primary", "member_indices"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["clusters"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "cluster_entities" } },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded, please retry later" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted" }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Fallback: each unique value gets its own cluster
        console.warn(`AI clustering failed for ${entityType}, falling back to exact match`);
        const byValue: Record<string, number[]> = {};
        items.forEach((item, idx) => {
          const key = item.value.toLowerCase();
          if (!byValue[key]) byValue[key] = [];
          byValue[key].push(idx);
        });
        clusterResults.push({
          entity_type: entityType,
          clusters: Object.entries(byValue).map(([, indices], i) => ({
            display_value: items[indices[0]].value,
            confidence: Math.max(...indices.map((idx) => items[idx].confidence)),
            is_primary: i === 0,
            member_indices: indices,
          })),
        });
        continue;
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

      if (!toolCall?.function?.arguments) {
        // Fallback
        const byValue: Record<string, number[]> = {};
        items.forEach((item, idx) => {
          const key = item.value.toLowerCase();
          if (!byValue[key]) byValue[key] = [];
          byValue[key].push(idx);
        });
        clusterResults.push({
          entity_type: entityType,
          clusters: Object.entries(byValue).map(([, indices], i) => ({
            display_value: items[indices[0]].value,
            confidence: Math.max(...indices.map((idx) => items[idx].confidence)),
            is_primary: i === 0,
            member_indices: indices,
          })),
        });
        continue;
      }

      const parsed = JSON.parse(toolCall.function.arguments);
      clusterResults.push({
        entity_type: entityType,
        clusters: parsed.clusters || [],
      });
    }

    // 5. Delete existing clusters for this case (idempotent)
    await supabase.from("entity_clusters").delete().eq("case_id", case_id);

    // 6. Persist clusters and members
    let totalClusters = 0;
    let totalMembers = 0;

    for (const result of clusterResults) {
      const items = byEntityType[result.entity_type];

      for (const cluster of result.clusters) {
        const { data: clusterRow, error: clusterErr } = await supabase
          .from("entity_clusters")
          .insert({
            tenant_id: tenantId,
            case_id: case_id,
            entity_type: result.entity_type,
            display_value: cluster.display_value,
            confidence: cluster.confidence ?? null,
            is_primary: cluster.is_primary ?? false,
            source_count: cluster.member_indices.length,
          })
          .select("id")
          .single();

        if (clusterErr || !clusterRow) {
          console.error("Failed to create cluster:", clusterErr?.message);
          continue;
        }

        totalClusters++;

        // Insert members
        const memberRecords = cluster.member_indices
          .filter((idx: number) => idx >= 0 && idx < items.length)
          .map((idx: number) => {
            const item = items[idx];
            return {
              tenant_id: tenantId,
              cluster_id: clusterRow.id,
              extraction_id: item.id,
              raw_value: item.value,
              document_id: item.document_id,
              source_page: item.source_page,
              source_snippet: item.source_snippet,
              match_score: item.confidence,
            };
          });

        if (memberRecords.length > 0) {
          const { error: memberErr } = await supabase
            .from("entity_cluster_members")
            .insert(memberRecords);

          if (memberErr) {
            console.error("Failed to insert members:", memberErr.message);
          } else {
            totalMembers += memberRecords.length;
          }
        }
      }
    }

    // 7. Sync entity clusters → case_parties for identity types
    const PARTY_ROLE_MAP: Record<string, string> = {
      claimant: "claimant",
      attorney: "attorney",
      law_firm: "firm",
      insurer: "insurer",
      provider: "provider",
    };

    let partiesCreated = 0;

    for (const result of clusterResults) {
      const partyRole = PARTY_ROLE_MAP[result.entity_type];
      if (!partyRole) continue;

      const items = byEntityType[result.entity_type];

      for (const cluster of result.clusters) {
        // Derive the display name
        const displayName = cluster.display_value;
        // Get first member's document_id for source linking
        const firstMemberIdx = cluster.member_indices[0];
        const sourceDocId = firstMemberIdx != null && items[firstMemberIdx]
          ? items[firstMemberIdx].document_id
          : null;

        // Upsert into case_parties: check if one already exists with same role + name
        const { data: existingParty } = await supabase
          .from("case_parties")
          .select("id")
          .eq("case_id", case_id)
          .eq("party_role", partyRole)
          .ilike("full_name", displayName)
          .limit(1)
          .maybeSingle();

        let partyId: string;

        if (existingParty) {
          partyId = existingParty.id;
        } else {
          const { data: newParty, error: partyErr } = await supabase
            .from("case_parties")
            .insert({
              tenant_id: tenantId,
              case_id: case_id,
              party_role: partyRole,
              full_name: displayName,
              notes: `Auto-created from entity normalization. Raw values: ${
                cluster.member_indices
                  .filter((idx: number) => idx >= 0 && idx < items.length)
                  .map((idx: number) => items[idx].value)
                  .join(", ")
              }`,
            })
            .select("id")
            .single();

          if (partyErr || !newParty) {
            console.error("Failed to create party:", partyErr?.message);
            continue;
          }
          partyId = newParty.id;
          partiesCreated++;
        }

        // Link active demand to claimant/attorney party
        if (partyRole === "claimant" && cluster.is_primary) {
          await supabase
            .from("demands")
            .update({ claimant_party_id: partyId })
            .eq("case_id", case_id)
            .eq("is_active", true);
        }
        if (partyRole === "attorney" && cluster.is_primary) {
          await supabase
            .from("demands")
            .update({ attorney_party_id: partyId })
            .eq("case_id", case_id)
            .eq("is_active", true);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        clusters_created: totalClusters,
        members_linked: totalMembers,
        parties_created: partiesCreated,
        entity_types_processed: Object.keys(byEntityType).length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Normalize entities error:", errMsg);

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
