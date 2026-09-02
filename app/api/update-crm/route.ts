import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function stripFences(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

const STAGES = ["Prospect", "Discovery", "Proposal", "Negotiation", "Committed", "Closed Won", "Closed Lost", "Dormant"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { meetingId } = await req.json();
  if (!meetingId) return Response.json({ error: "meetingId required" }, { status: 400 });

  const { data: meeting } = await supabaseAdmin
    .from("meetings").select("id, adviser_id, client_id, client_summary, objective").eq("id", meetingId).single();
  if (!meeting || meeting.adviser_id !== user.id) return Response.json({ error: "not found" }, { status: 404 });

  const { data: client } = await supabaseAdmin
    .from("clients").select("id, full_name, sales_stage, next_action").eq("id", meeting.client_id).single();

  const { data: factsRow } = await supabaseAdmin
    .from("extracted_facts").select("payload").eq("meeting_id", meetingId).maybeSingle();
  const facts = factsRow?.payload ?? {};

  const currentStage = client?.sales_stage ?? "not set";

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      system: `You are updating a CRM record after a meeting. The client is ${client?.full_name}.
Their current sales stage is: ${currentStage}.

Valid stages, in order: ${STAGES.join(" → ")}

Based on what actually happened in this meeting, output raw JSON only, no markdown fences:

{
  "sales_stage": "one of the valid stages above",
  "stage_changed": true or false,
  "rationale": "One sentence on why this stage is correct after this meeting",
  "next_action": "The single most important next thing the adviser should do, one sentence",
  "risk_note": "The main risk to this deal or relationship right now, one sentence. Empty string if none evident."
}

Be conservative about advancing the stage — only move forward if the meeting genuinely evidenced
it. A good conversation is not the same as a commitment. It is completely valid to keep the same
stage, or to move backwards if the meeting revealed a problem. If nothing in the meeting justifies
a change, set stage_changed to false and keep the current stage.

MEETING OBJECTIVE: ${meeting.objective ?? "none set"}
OBJECTIVE OUTCOME: ${facts.objective_assessment?.achieved ?? "not assessed"} — ${facts.objective_assessment?.summary ?? ""}
CLIENT SENTIMENT: ${facts.client_sentiment?.overall_satisfaction ?? "unknown"}
CONCERNS RAISED: ${(facts.client_sentiment?.dissatisfaction_signals ?? []).join("; ") || "none"}
OUTSTANDING ITEMS: ${(facts.attention_items ?? []).map((a: any) => a.title).join("; ") || "none"}
ACTION ITEMS: ${(facts.action_items ?? []).map((a: any) => a.description).join("; ") || "none"}

MEETING SUMMARY:
${meeting.client_summary ?? "No summary available."}`,
      messages: [{ role: "user", content: "Update the CRM record." }],
    });

    const raw = response.content.find((b) => b.type === "text")!.text;
    const update = JSON.parse(stripFences(raw));

    if (!STAGES.includes(update.sales_stage)) {
      return Response.json({ error: `Invalid stage returned: ${update.sales_stage}` }, { status: 500 });
    }

    if (update.stage_changed && update.sales_stage !== client?.sales_stage) {
      await supabaseAdmin.from("client_stage_history").insert({
        client_id: meeting.client_id,
        from_stage: client?.sales_stage ?? null,
        to_stage: update.sales_stage,
        meeting_id: meetingId,
        rationale: update.rationale,
      });
    }

    await supabaseAdmin.from("clients").update({
      sales_stage: update.sales_stage,
      stage_updated_at: new Date().toISOString(),
      next_action: update.next_action,
      risk_note: update.risk_note || null,
    }).eq("id", meeting.client_id);

    return Response.json({ ok: true, update });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
