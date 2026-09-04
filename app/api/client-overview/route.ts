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

  const { clientId } = await req.json();
  if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 });

  const { data: client } = await supabaseAdmin
    .from("clients").select("id, full_name, adviser_id").eq("id", clientId).single();
  if (!client || client.adviser_id !== user.id) return Response.json({ error: "not found" }, { status: 404 });

  const { data: meetings } = await supabaseAdmin
    .from("meetings").select("id, created_at, objective, client_summary")
    .eq("client_id", clientId).eq("status", "done").order("created_at");

  if (!meetings?.length) {
    return Response.json({ overview: null, message: "No completed meetings yet." });
  }

  const { data: intel } = await supabaseAdmin
    .from("intelligence_objects")
    .select("object_type, label, value, temporal_status, confidence, evidence_quote, evidence_timestamp, meeting_id, contacts(full_name), meetings(created_at)")
    .eq("client_id", clientId).neq("validation_status", "rejected")
    .order("created_at", { ascending: true });

  const { data: actions } = await supabaseAdmin
    .from("actions").select("description, owner, status, meeting_id").eq("client_id", clientId);

  const { data: contacts } = await supabaseAdmin
    .from("contacts").select("id, full_name, title").eq("client_id", clientId);

  const history = meetings.map((m: any, i: number) =>
    `MEETING ${i + 1} — ${new Date(m.created_at).toLocaleDateString()}${m.objective ? ` (objective: ${m.objective})` : ""}\n${m.client_summary ?? ""}`
  ).join("\n\n");

  const intelText = (intel ?? []).map((i: any) =>
    `${i.meetings?.created_at ? new Date(i.meetings.created_at).toLocaleDateString() : "?"} [${i.temporal_status}] ${i.object_type} — ${i.contacts?.full_name ?? "unattributed"} — ${i.label}: ${i.value}${i.evidence_quote ? ` | "${i.evidence_quote}" ${i.evidence_timestamp ?? ""}` : ""} (meeting:${i.meeting_id})`
  ).join("\n") || "No structured intelligence yet.";

  const actionsText = (actions ?? []).map((a: any) => `[${a.status}] ${a.description} — ${a.owner} (meeting:${a.meeting_id})`).join("\n") || "None.";
  const contactsText = (contacts ?? []).map((c: any) => `${c.full_name}${c.title ? `, ${c.title}` : ""}`).join("\n") || "None recorded.";

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: `Synthesise the complete account position for ${client.full_name} across all ${meetings.length} meetings.

Output raw JSON only, no fences:

{
  "relationship_status": "Short phrase, e.g. Active strategic work, Stalled, Early exploration",
  "current_position": "3-4 sentences synthesising where this relationship stands, drawing on the full history not just the latest meeting",
  "what_matters_now": [
    { "item": "Short label", "detail": "One sentence", "why_now": "Why this is live right now", "meeting_id": "the meeting id it came from or null" }
  ],
  "open_questions": [
    { "question": "...", "raised_by": "person name or null", "since": "date it was first raised", "meeting_id": "..." }
  ],
  "risks": [
    { "risk": "...", "severity": "high | medium | low", "detail": "One sentence", "meeting_id": "..." }
  ],
  "recent_changes": [
    { "what": "Short label", "from": "Previous position", "to": "Current position", "person": "who", "confidence": "high | medium | low", "meeting_id": "..." }
  ],
  "trajectory": {
    "direction": "advancing | steady | stalling | deteriorating",
    "reasoning": "Two sentences citing specific evidence across meetings"
  },
  "outstanding_commitments": [
    { "commitment": "...", "owed_by": "us | them", "person": "who", "since": "date", "status": "outstanding | overdue", "meeting_id": "..." }
  ],
  "key_contacts": [
    { "name": "...", "influence": "high | medium | low | unknown", "disposition": "Short phrase on where they currently stand" }
  ]
}

Rank what_matters_now by genuine importance. Maximum 6 per array. Use real meeting ids from the
data. Mark a commitment "overdue" only if a later meeting passed without it being resolved. Never
invent — if the record doesn't support something, omit it. Do not state inferences as certainty.

CONTACTS:
${contactsText}

ACTIONS:
${actionsText}

TRACKED INTELLIGENCE (chronological):
${intelText}

MEETING HISTORY:
${history}`,
      messages: [{ role: "user", content: "Synthesise the account overview." }],
    });

    if (res.stop_reason === "max_tokens") {
      return Response.json({ error: "Response truncated — retry." }, { status: 500 });
    }

    const overview = JSON.parse(stripFences(res.content.find((b) => b.type === "text")!.text));
    return Response.json({ overview, meetingCount: meetings.length, contactCount: contacts?.length ?? 0, lastInteraction: meetings[meetings.length - 1].created_at });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
