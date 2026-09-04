import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function stripFences(t: string) {
  return t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { data: clients } = await supabaseAdmin
    .from("clients").select("id, full_name").eq("adviser_id", user.id);
  const clientIds = (clients ?? []).map((c) => c.id);
  if (!clientIds.length) return Response.json({ alerts: [], message: "No clients yet." });

  const { data: intel } = await supabaseAdmin
    .from("intelligence_objects")
    .select("object_type, label, value, temporal_status, client_id, meeting_id, contacts(full_name), meetings(created_at)")
    .in("client_id", clientIds).neq("validation_status", "rejected")
    .order("created_at", { ascending: false }).limit(120);

  const { data: actions } = await supabaseAdmin
    .from("actions").select("description, owner, status, client_id, created_at").in("client_id", clientIds);

  const { data: meetings } = await supabaseAdmin
    .from("meetings").select("id, client_id, created_at").in("client_id", clientIds).eq("status", "done")
    .order("created_at", { ascending: false });

  if (!intel?.length) {
    return Response.json({ alerts: [], message: "No intelligence recorded yet. Run 'Rebuild intelligence' on some meetings first." });
  }

  const nameById: Record<string, string> = {};
  for (const c of clients ?? []) nameById[c.id] = c.full_name;

  const lastMeetingByClient: Record<string, string> = {};
  for (const m of meetings ?? []) {
    if (!lastMeetingByClient[m.client_id]) lastMeetingByClient[m.client_id] = m.created_at;
  }

  const intelText = (intel ?? []).map((i: any) =>
    `${nameById[i.client_id]} | ${i.meetings?.created_at ? new Date(i.meetings.created_at).toLocaleDateString() : "?"} | [${i.temporal_status}] ${i.object_type} | ${i.contacts?.full_name ?? "unattributed"} | ${i.label}: ${i.value} (client:${i.client_id})`
  ).join("\n");

  const actionsText = (actions ?? []).map((a: any) =>
    `${nameById[a.client_id]} | [${a.status}] ${a.description} — ${a.owner} | raised ${new Date(a.created_at).toLocaleDateString()} (client:${a.client_id})`
  ).join("\n") || "None.";

  const lastSeenText = Object.entries(lastMeetingByClient).map(([cid, date]) =>
    `${nameById[cid]}: last met ${new Date(date).toLocaleDateString()} (client:${cid})`
  ).join("\n");

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: `You surface what genuinely deserves a salesperson's attention right now across all
their clients. Today is ${new Date().toLocaleDateString()}.

Output raw JSON only, no fences:

{
  "alerts": [
    {
      "type": "overdue_commitment | repeated_unresolved | relationship_change | emerging_opportunity | contradiction | going_cold",
      "client_id": "the client:ID from the data",
      "client_name": "...",
      "headline": "One line, under 12 words",
      "detail": "Two sentences explaining what and why it matters now",
      "urgency": "high | medium | low"
    }
  ]
}

What each type means:
- overdue_commitment: someone promised something and no later meeting confirms it happened
- repeated_unresolved: the same issue has stayed open across multiple meetings
- relationship_change: someone's position has genuinely shifted, for better or worse
- emerging_opportunity: something mentioned more than once but never acted on
- contradiction: two statements that conflict
- going_cold: meaningful time has passed with an open thread and no contact

Maximum 8 alerts, ranked by genuine urgency. Only surface things that are real and actionable —
never manufacture an alert to fill space. If nothing genuinely needs attention, return an empty
array. Use real client_id values from the data.

LAST CONTACT PER CLIENT:
${lastSeenText}

ACTIONS:
${actionsText}

TRACKED INTELLIGENCE:
${intelText}`,
      messages: [{ role: "user", content: "What needs my attention?" }],
    });

    const parsed = JSON.parse(stripFences(res.content.find((b) => b.type === "text")!.text));
    return Response.json({ alerts: parsed.alerts ?? [] });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
