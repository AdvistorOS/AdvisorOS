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

  const { contactId } = await req.json();
  if (!contactId) return Response.json({ error: "contactId required" }, { status: 400 });

  const { data: contact } = await supabaseAdmin
    .from("contacts").select("id, full_name, title, client_id, clients(full_name, adviser_id)")
    .eq("id", contactId).single();
  if (!contact || (contact.clients as any)?.adviser_id !== user.id) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const { data: intel } = await supabaseAdmin
    .from("intelligence_objects")
    .select("object_type, label, value, temporal_status, evidence_quote, evidence_timestamp, meeting_id, meetings(created_at)")
    .eq("contact_id", contactId).neq("validation_status", "rejected")
    .order("created_at", { ascending: true });

  const { data: attendance } = await supabaseAdmin
    .from("meeting_attendees").select("meeting_id, meetings(created_at, objective)")
    .eq("contact_id", contactId);

  if (!intel?.length) {
    return Response.json({ evolution: null, message: "No intelligence recorded for this person yet. Map them via 'Who's who' on their meetings, then rebuild intelligence." });
  }

  const timeline = intel.map((i: any) =>
    `${i.meetings?.created_at ? new Date(i.meetings.created_at).toLocaleDateString() : "?"} [${i.temporal_status}] ${i.object_type} — ${i.label}: ${i.value}` +
    (i.evidence_quote ? ` | "${i.evidence_quote}"${i.evidence_timestamp ? ` at ${i.evidence_timestamp}` : ""} (meeting:${i.meeting_id})` : "")
  ).join("\n");

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: `Build a profile of ${contact.full_name}${contact.title ? `, ${contact.title}` : ""} at ${(contact.clients as any)?.full_name}, based on everything they have said across ${attendance?.length ?? 0} meetings.

Output raw JSON only, no fences:

{
  "summary": "Two sentences on who this person is in this relationship and where they currently stand",
  "influence": "high | medium | low | unknown",
  "influence_reasoning": "One sentence on what the evidence suggests about their decision-making weight",
  "relationship_strength": "strong | developing | neutral | strained | unknown",
  "position_evolution": [
    {
      "topic": "What the position is about",
      "initial": "What they originally thought or said",
      "current": "Where they are now",
      "confidence": "high | medium | low",
      "evidence": "(meeting:ID at mm:ss) format, or empty string"
    }
  ],
  "priorities": ["Short phrases on what drives them"],
  "concerns": ["Short phrases on what worries them"],
  "commitments": [ { "what": "...", "status": "outstanding | fulfilled | unclear" } ],
  "communication_style": "One sentence on how they engage in conversation",
  "engages_strongly_on": ["Topics where they lean in"],
  "resistant_on": ["Topics where they push back"],
  "key_quotes": [ { "quote": "Under 25 words", "why": "Why this is revealing", "evidence": "(meeting:ID at mm:ss)" } ],
  "open_questions": ["Things still unanswered involving this person"]
}

Only include position_evolution entries where the record genuinely shows a change over time — if
their position has been consistent, return an empty array rather than manufacturing movement.
Maximum 4 entries per array. Never state an inference as certainty. If evidence is thin, say so
via low confidence rather than inventing detail.

CHRONOLOGICAL RECORD:
${timeline}`,
      messages: [{ role: "user", content: "Build the profile." }],
    });

    if (res.stop_reason === "max_tokens") {
      return Response.json({ error: "Response truncated — retry." }, { status: 500 });
    }

    const evolution = JSON.parse(stripFences(res.content.find((b) => b.type === "text")!.text));
    return Response.json({ evolution, meetingCount: attendance?.length ?? 0 });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
