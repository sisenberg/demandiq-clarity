import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-idempotency-key",
};

const VALID_STATUSES = ["represented", "unrepresented", "unknown"] as const;
const VALID_EVENT_TYPES = [
  "representation_status_recorded",
  "representation_confirmed_unrepresented",
  "attorney_retained",
  "attorney_substituted",
  "attorney_withdrew",
] as const;

// Event type mapping for internal platform events
const EVENT_TYPE_TO_PLATFORM_EVENT: Record<string, string> = {
  representation_status_recorded: "casualtyiq.claimant.representation_recorded.v1",
  representation_confirmed_unrepresented: "casualtyiq.claimant.representation_recorded.v1",
  attorney_retained: "casualtyiq.claimant.attorney_retained.v1",
  attorney_substituted: "casualtyiq.claimant.attorney_substituted.v1",
  attorney_withdrew: "casualtyiq.claimant.attorney_withdrew.v1",
};

interface RepresentationRecord {
  id: string;
  tenant_id: string;
  case_id: string;
  claimant_id: string;
  representation_status: string;
  event_type: string;
  attorney_name: string | null;
  firm_name: string | null;
  source_party_id: string | null;
  occurred_at: string;
  recorded_at: string;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

function deriveContext(history: RepresentationRecord[]) {
  if (!history || history.length === 0) {
    return {
      representation_status_current: "unknown" as const,
      current_attorney_name: null,
      current_firm_name: null,
      representation_transition_flag: false,
      history_count: 0,
    };
  }
  const sorted = [...history].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );
  const latest = sorted[sorted.length - 1];
  const statuses = new Set(sorted.map((r) => r.representation_status));
  const transitionFlag = statuses.has("represented") && statuses.has("unrepresented");

  return {
    representation_status_current: latest.representation_status,
    current_attorney_name:
      latest.representation_status === "represented" ? latest.attorney_name : null,
    current_firm_name:
      latest.representation_status === "represented" ? latest.firm_name : null,
    representation_transition_flag: transitionFlag,
    history_count: sorted.length,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user token
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for DB ops
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get tenant_id
    const { data: tenantData } = await serviceClient.rpc("get_user_tenant_id", {
      _user_id: user.id,
    });
    const tenantId = tenantData as string | null;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "No tenant context" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse URL path: expect /representation-history or /representation-history?claimant_id=X&case_id=Y
    const url = new URL(req.url);
    const claimantId = url.searchParams.get("claimant_id");
    const caseId = url.searchParams.get("case_id");

    if (!claimantId || !caseId) {
      return new Response(
        JSON.stringify({ error: "claimant_id and case_id query params required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify claimant belongs to tenant
    const { data: party } = await serviceClient
      .from("case_parties")
      .select("id, tenant_id")
      .eq("id", claimantId)
      .eq("case_id", caseId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!party) {
      return new Response(JSON.stringify({ error: "Claimant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── GET: read history + derived context ─────────────────
    if (req.method === "GET") {
      const { data: history, error: fetchErr } = await serviceClient
        .from("claimant_representation_history")
        .select("*")
        .eq("case_id", caseId)
        .eq("claimant_id", claimantId)
        .eq("tenant_id", tenantId)
        .order("occurred_at", { ascending: true });

      if (fetchErr) throw fetchErr;

      const records = (history ?? []) as RepresentationRecord[];
      const context = deriveContext(records);

      return new Response(
        JSON.stringify({
          representation_context: context,
          history: records,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── POST: append representation event ───────────────────
    if (req.method === "POST") {
      const body = await req.json();

      // Validate required fields
      if (!body.event_type || !body.representation_status) {
        return new Response(
          JSON.stringify({ error: "event_type and representation_status are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!VALID_STATUSES.includes(body.representation_status)) {
        return new Response(
          JSON.stringify({ error: `Invalid representation_status. Must be one of: ${VALID_STATUSES.join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!VALID_EVENT_TYPES.includes(body.event_type)) {
        return new Response(
          JSON.stringify({ error: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Idempotency: check x-idempotency-key header
      const idempotencyKey = req.headers.get("x-idempotency-key");
      if (idempotencyKey) {
        const { data: existing } = await serviceClient
          .from("claimant_representation_history")
          .select("id")
          .eq("case_id", caseId)
          .eq("claimant_id", claimantId)
          .eq("tenant_id", tenantId)
          .eq("event_type", body.event_type)
          .eq("occurred_at", body.occurred_at ?? "")
          .eq("notes", idempotencyKey)
          .maybeSingle();

        if (existing) {
          // Already processed — return existing without re-inserting
          const { data: fullHistory } = await serviceClient
            .from("claimant_representation_history")
            .select("*")
            .eq("case_id", caseId)
            .eq("claimant_id", claimantId)
            .eq("tenant_id", tenantId)
            .order("occurred_at", { ascending: true });

          return new Response(
            JSON.stringify({
              representation_context: deriveContext((fullHistory ?? []) as RepresentationRecord[]),
              created_record_id: existing.id,
              idempotent: true,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const now = new Date().toISOString();
      const record = {
        tenant_id: tenantId,
        case_id: caseId,
        claimant_id: claimantId,
        representation_status: body.representation_status,
        event_type: body.event_type,
        attorney_name: body.attorney_name ?? null,
        firm_name: body.firm_name ?? null,
        source_party_id: body.source_party_id ?? null,
        occurred_at: body.occurred_at ?? now,
        recorded_at: now,
        notes: idempotencyKey ?? body.notes ?? null,
        created_by_user_id: user.id,
      };

      const { data: inserted, error: insertErr } = await serviceClient
        .from("claimant_representation_history")
        .insert(record)
        .select()
        .single();

      if (insertErr) throw insertErr;

      const insertedRecord = inserted as RepresentationRecord;

      // Audit log
      await serviceClient.from("audit_events").insert({
        tenant_id: tenantId,
        case_id: caseId,
        actor_user_id: user.id,
        entity_type: "claimant_representation_history",
        entity_id: insertedRecord.id,
        action_type: "created",
        after_value: record,
      });

      // Fetch updated history for context
      const { data: updatedHistory } = await serviceClient
        .from("claimant_representation_history")
        .select("*")
        .eq("case_id", caseId)
        .eq("claimant_id", claimantId)
        .eq("tenant_id", tenantId)
        .order("occurred_at", { ascending: true });

      const context = deriveContext((updatedHistory ?? []) as RepresentationRecord[]);

      // Emit internal platform event via Supabase Realtime broadcast
      const platformEventName =
        EVENT_TYPE_TO_PLATFORM_EVENT[body.event_type] ??
        "casualtyiq.claimant.representation_recorded.v1";

      const platformEventPayload = {
        event_name: platformEventName,
        tenant_id: tenantId,
        case_id: caseId,
        claimant_id: claimantId,
        representation_status: body.representation_status,
        event_type: body.event_type,
        attorney_name: body.attorney_name ?? null,
        firm_name: body.firm_name ?? null,
        occurred_at: record.occurred_at,
        recorded_at: record.recorded_at,
        representation_transition_flag: context.representation_transition_flag,
        record_id: insertedRecord.id,
      };

      // Broadcast to a tenant-scoped channel
      const channel = serviceClient.channel(`representation-events-${tenantId}`);
      await channel.send({
        type: "broadcast",
        event: platformEventName,
        payload: platformEventPayload,
      });
      await serviceClient.removeChannel(channel);

      return new Response(
        JSON.stringify({
          representation_context: context,
          created_record_id: insertedRecord.id,
          platform_event: platformEventName,
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("representation-history error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
