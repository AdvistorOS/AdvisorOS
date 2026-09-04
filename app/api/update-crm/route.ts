import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function stripFences(t: string) {
  return t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { meetingId } = await req.json();
  if (!meetingId) return Response.json({ error: "meetingId required" }, { status: 400 });

  const { data: meeting } = await supabaseAdmin
    .from("meetings").select("id, adviser_id, client_id, client_summary, objective").eq("id", meetingId).single();
  if (!meeting || meeting.adviser_id !== user.id) return Response.json({ error: "not found" }, { status: 404 });

  const { data: factsRow } = await supabaseAdmin
    .from("extracted_facts").select("payload").eq("meeting_id", meetingId).maybeSingle();
  const facts = factsRow?.payload ?? {};

  const { data: intel } = await supabaseAdmin
    .from("intelligence_objects").select("object_type, label, value, temporal_status")
    .eq("meeting_id", meetingId).neq("validation_status", "rejected");

  const intelText = (intel ?? []).map((i: any) => `[${i.temporal_status}] ${i.object_type} — ${i.label}: ${i.value}`).join("\n") || "None recorded.";

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: `Based on this meeting, set the two live signals on the client record.

Output raw JSON only, no fences:

{
  "next_action": "The single most important thing the adviser should do next, one sentence",
  "risk_note": "The main live risk to this relationship right now, one sentence. Empty string if none evident."
}

Base this on what actually happened. Do not invent a risk to seem thorough — an empty string is
correct when nothing genuine is at risk.

MEETING OBJECTIVE: ${meeting.objective ?? "none set"}
OBJECTIVE OUTCOME: ${facts.objective_assessment?.achieved ?? "not assessed"}
CONCERNS RAISED: ${(facts.client_sentiment?.dissatisfaction_signals ?? []).join("; ") || "none"}
OUTSTANDING: ${(facts.attention_items ?? []).map((a: any) => a.title).join("; ") || "none"}

INTELLIGENCE FROM THIS MEETING:
${intelText}

SUMMARY:
${meeting.client_summary ?? "n/a"}`,
      messages: [{ role: "user", content: "Set the signals." }],
    });

    const update = JSON.parse(stripFences(res.content.find((b) => b.type === "text")!.text));

    await supabaseAdmin.from("clients").update({
      next_action: update.next_action || null,
      risk_note: update.risk_note || null,
    }).eq("id", meeting.client_id);

    return Response.json({ ok: true, update });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
