import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { meetingId } = await req.json();
  if (!meetingId) return Response.json({ error: "meetingId required" }, { status: 400 });

  const { data: meeting } = await supabaseAdmin
    .from("meetings").select("id, adviser_id, client_id, objective, title, prep_notes, clients(full_name)")
    .eq("id", meetingId).single();
  if (!meeting || meeting.adviser_id !== user.id) return Response.json({ error: "not found" }, { status: 404 });

  const { data: attendees } = await supabaseAdmin
    .from("meeting_attendees").select("contact_id, contacts(id, full_name, title, participant_type)")
    .eq("meeting_id", meetingId);

  const { data: past } = await supabaseAdmin
    .from("meetings").select("id, created_at, objective, client_summary")
    .eq("client_id", meeting.client_id).eq("status", "done")
    .order("created_at", { ascending: false }).limit(6);

  const { data: intel } = await supabaseAdmin
    .from("intelligence_objects")
    .select("object_type, label, value, temporal_status, evidence_quote, evidence_timestamp, meeting_id, contacts(full_name), meetings(created_at)")
    .eq("client_id", meeting.client_id).neq("validation_status", "rejected")
    .order("created_at", { ascending: false }).limit(50);

  const { data: openActions } = await supabaseAdmin
    .from("actions").select("description, owner").eq("client_id", meeting.client_id).eq("status", "open");

  if (!past?.length) {
    return Response.json({ brief: "No previous meetings with this client — this is your first conversation." });
  }

  const attendeeText = (attendees ?? []).map((a: any) =>
    `${a.contacts?.full_name}${a.contacts?.title ? `, ${a.contacts.title}` : ""} (${a.contacts?.participant_type ?? "client"})`
  ).join("\n") || "No attendees listed.";

  const intelText = (intel ?? []).map((i: any) =>
    `${i.meetings?.created_at ? new Date(i.meetings.created_at).toLocaleDateString() : "?"} [${i.temporal_status}] ${i.object_type} — ${i.contacts?.full_name ?? "unattributed"} — ${i.label}: ${i.value}` +
    (i.evidence_quote ? ` | "${i.evidence_quote}"${i.evidence_timestamp ? ` at ${i.evidence_timestamp}` : ""} (meeting:${i.meeting_id})` : "")
  ).join("\n") || "No tracked intelligence.";

  const historyText = past.map((p: any) =>
    `${new Date(p.created_at).toLocaleDateString()}${p.objective ? ` — objective: ${p.objective}` : ""}\n${p.client_summary ?? ""}`
  ).join("\n\n");

  const actionsText = (openActions ?? []).map((a: any) => `- ${a.description} (${a.owner})`).join("\n") || "None open.";

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: `Prepare the adviser for an upcoming meeting with ${(meeting.clients as any)?.full_name}.

Use these exact headers:

WHERE THINGS STAND
SINCE YOU LAST SPOKE
WHAT EACH ATTENDEE CARES ABOUT
WE OWE THEM
THEY OWE US
OPEN OBJECTIONS
OPEN QUESTIONS
KNOWN RISKS
DON'T FORGET
SUGGESTED QUESTIONS
SUGGESTED APPROACH
WHAT SUCCESS LOOKS LIKE

Short bullets under each. Where a point comes from a specific moment, cite it as
(meeting:ID at mm:ss) so it can be linked. Name real people. If a section has nothing genuine,
write "Nothing outstanding." Never invent.

THIS MEETING'S OBJECTIVE: ${meeting.objective || "not set"}
${meeting.prep_notes ? `ADVISER'S NOTES: ${meeting.prep_notes}` : ""}

ATTENDEES:
${attendeeText}

OPEN ACTIONS:
${actionsText}

TRACKED INTELLIGENCE:
${intelText}

PREVIOUS MEETINGS:
${historyText}`,
      messages: [{ role: "user", content: "Write the pre-meeting brief." }],
    });

    const brief = res.content.find((b) => b.type === "text")?.text ?? "";

    await supabaseAdmin.from("prep_briefs").delete().eq("meeting_id", meetingId);
    await supabaseAdmin.from("prep_briefs").insert({ meeting_id: meetingId, content: brief });

    return Response.json({ brief });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
