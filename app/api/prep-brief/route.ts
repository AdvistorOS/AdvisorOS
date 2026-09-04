import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { clientId } = await req.json();
  if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 });

  const { data: client } = await supabaseAdmin
    .from("clients").select("id, full_name, adviser_id, sales_stage").eq("id", clientId).single();
  if (!client || client.adviser_id !== user.id) return Response.json({ error: "not found" }, { status: 404 });

  const { data: intel } = await supabaseAdmin
    .from("intelligence_objects")
    .select("object_type, label, value, temporal_status, confidence, evidence_quote, contacts(full_name), meetings(created_at)")
    .eq("client_id", clientId)
    .neq("temporal_status", "superseded")
    .order("created_at", { ascending: false })
    .limit(40);

  const { data: openActions } = await supabaseAdmin
    .from("actions").select("description, owner").eq("client_id", clientId).eq("status", "open");

  const { data: meetings } = await supabaseAdmin
    .from("meetings").select("created_at, objective, client_summary")
    .eq("client_id", clientId).eq("status", "done")
    .order("created_at", { ascending: false }).limit(3);

  if (!meetings?.length) {
    return Response.json({ brief: "No completed meetings yet for this client." });
  }

  const intelText = (intel ?? []).length
    ? (intel ?? []).map((i: any) =>
        `[${i.temporal_status.toUpperCase()}] ${i.object_type} — ${i.label}: ${i.value}` +
        (i.contacts?.full_name ? ` (${i.contacts.full_name})` : "") +
        (i.meetings?.created_at ? ` — ${new Date(i.meetings.created_at).toLocaleDateString()}` : "")
      ).join("\n")
    : "No structured intelligence yet.";

  const actionsText = (openActions ?? []).map((a: any) => `- ${a.description} (${a.owner})`).join("\n") || "None open.";
  const recentText = meetings.map((m: any) =>
    `${new Date(m.created_at).toLocaleDateString()}${m.objective ? ` — objective: ${m.objective}` : ""}\n${m.client_summary ?? ""}`
  ).join("\n\n");

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      system: `Brief the adviser before their next meeting with ${client.full_name}. They should be
able to read this in 30 seconds and walk in prepared.

Use these headers:

WHERE WE ARE
- Two short bullets on the current state of the relationship

WHAT'S CHANGED SINCE LAST TIME
- Bullets for anything marked CHANGED, CONTRADICTED or ESCALATING below. If nothing changed, write "Nothing significant."

STILL OPEN
- Unresolved questions, commitments outstanding, anything marked UNRESOLVED

WATCH FOR
- Concerns or objections likely to resurface, naming who raised them

FOCUS THIS MEETING
- One bullet: what this meeting should achieve and why

Short punchy bullets, max 20 words each. Name real people. Never invent — if the record doesn't
support something, leave it out.

STRUCTURED INTELLIGENCE (status-tagged, most recent first):
${intelText}

OPEN ACTIONS:
${actionsText}

RECENT MEETINGS:
${recentText}`,
      messages: [{ role: "user", content: "Write the briefing." }],
    });

    return Response.json({ brief: res.content.find((b) => b.type === "text")?.text ?? "" });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
