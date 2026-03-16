import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { case_id, query, candidate_chunk_ids, top_k = 10 } = await req.json();

    if (!case_id || !query || !candidate_chunk_ids?.length) {
      return new Response(
        JSON.stringify({ error: "case_id, query, and candidate_chunk_ids required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch chunk texts for candidates (limit to 30 to keep prompt small)
    const ids = candidate_chunk_ids.slice(0, 30);
    const { data: chunks, error: chunkErr } = await supabase
      .from("document_chunks")
      .select("id, chunk_text, chunk_index, page_start, page_end")
      .in("id", ids);

    if (chunkErr) throw chunkErr;
    if (!chunks?.length) {
      return new Response(
        JSON.stringify({ ranked_chunks: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build ranking prompt with truncated chunks
    const chunkSummaries = chunks.map((c: any, i: number) => {
      const preview = c.chunk_text.length > 500
        ? c.chunk_text.slice(0, 500) + "..."
        : c.chunk_text;
      return `[CHUNK_${i}] id=${c.id} pages=${c.page_start}-${c.page_end}\n${preview}`;
    }).join("\n\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback: return chunks in original order with uniform scores
      return new Response(
        JSON.stringify({
          ranked_chunks: chunks.slice(0, top_k).map((c: any) => ({
            chunk_id: c.id,
            relevance_score: 0.5,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a legal document retrieval ranking system for insurance claims. Given a search query and document chunks, rank them by relevance. Return ONLY the ranking.`,
          },
          {
            role: "user",
            content: `Rank these chunks by relevance to the query: "${query}"\n\nReturn the top ${top_k} most relevant chunks.\n\n${chunkSummaries}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "rank_chunks",
              description: "Return ranked chunks by relevance",
              parameters: {
                type: "object",
                properties: {
                  rankings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        chunk_id: { type: "string" },
                        relevance_score: { type: "number", minimum: 0, maximum: 1 },
                        reason: { type: "string" },
                      },
                      required: ["chunk_id", "relevance_score"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["rankings"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "rank_chunks" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[search-chunks] AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fallback to lexical order
      return new Response(
        JSON.stringify({
          ranked_chunks: chunks.slice(0, top_k).map((c: any) => ({
            chunk_id: c.id,
            relevance_score: 0.5,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({
          ranked_chunks: chunks.slice(0, top_k).map((c: any) => ({
            chunk_id: c.id,
            relevance_score: 0.5,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const rankings = (parsed.rankings ?? [])
      .filter((r: any) => r.chunk_id && typeof r.relevance_score === "number")
      .slice(0, top_k);

    console.log(`[search-chunks] Ranked ${rankings.length} chunks for query: "${query.slice(0, 50)}..."`);

    return new Response(
      JSON.stringify({ ranked_chunks: rankings }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[search-chunks] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
