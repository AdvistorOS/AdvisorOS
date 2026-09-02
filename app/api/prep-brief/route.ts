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
    .from("clients").select("id, full_name, adviser_id").eq("id", clientId).single();
  if (!client || client.adviser_id !== user.id) return Response.json({ error: "not found" }, { status: 404 });

  const { data: meetings } = await supabaseAdmin
    .from("meetings").select("id, created_at, objective, client_summary")
    .eq("client_id", clientId).eq("status", "done").order("created_at", { ascending: false }).limit(5);

  if (!meetings?.length) {
    return Response.json({ brief: "No completed meetings yet for this client — nothing to brief from." });
  }

  const { data: factsRows } = await supabaseAdmin
    .from("extracted_facts").select("meeting_id, payload").in("meeting_id", meetings.map((m) => m.id));
  const factsByMeeting: Record<string, any> = {};
  for (const f of factsRows ?? []) factsByMeeting[f.meeting_id] = f.payload;

  const { data: openActions } = await supabaseAdmin
    .from("actions").select("description, owner").eq("client_id", clientId).eq("status", "open");

  const { data: clientFacts } = await supabaseAdmin
    .from("client_facts").select("category, data").eq("client_id", clientId).is("superseded_by", null);

  const { data: contacts } = await supabaseAdmin
    .from("contacts").select("id, full_name").eq("client_id", clientId);
  const { data: profiles } = await supabaseAdmin
    .from("contact_profiles").select("contact_id, data")
    .in("contact_id", (contacts ?? []).map((c) => c.id)).is("superseded_by", null);
  const profileByContact: Record<string, any> = {};
  for (const p of profiles ?? []) profileByContact[p.contact_id] = p.data;

  const historyText = meetings.map((m: any, i: number) => {
    const f = factsByMeeting[m.id] ?? {};
    const obj = m.objective ? `Objective: ${m.objective} — ${f.objective_assessment?.achieved ?? "not assessed"}` : "";
    const sentiment = f.client_sentiment?.overall_satisfaction ? `Sentiment: ${f.client_sentiment.overall_satisfaction}` : "";
    const attention = (f.attention_items ?? []).map((a: any) => a.title).join(", ");
    return `Meeting ${i + 1} (${new Date(m.created_at).toLocaleDateString()}):\n${obj}\n${sentiment}\nSummary: ${m.client_summary ?? "N/A"}\nOutstanding: ${attention || "none flagged"}`;
  }).join("\n\n");

  const contactsText = (contacts ?? []).map((c: any) => {
    const p = profileByContact[c.id];
    if (!p) return `${c.full_name}: no profile yet`;
    return `${c.full_name} — tone: ${p.emotional_tone ?? "n/a"}; motives: ${(p.motives ?? []).join(", ") || "none noted"}; concerns: ${(p.concerns ?? []).join(", ") || "none noted"}`;
  }).join("\n") || "No individual contacts on record.";

  const actionsText = (openActions ?? []).map((a: any) => `- ${a.description} (${a.owner})`).join("\n") || "No open actions.";
  const factsText = (clientFacts ?? []).map((f: any) => `${f.data.label}: ${f.data.value}`).join("\n") || "No confirmed facts.";

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      system: `You are preparing a briefing for ${client.full_name} before the next meeting.
Write it so someone can read it in 30 seconds and walk in prepared. Use these sections with
clear headers:

WHERE WE ARE — two sentences on the current state of the relationship
OPEN ITEMS — what's outstanding, who owes what
WATCH FOR — concerns, objections, or sensitivities likely to come up
SUGGESTED FOCUS — what this next meeting should aim to achieve, and why

Be specific and grounded in the history below. Do not invent anything. If something isn't
evidenced, leave it out rather than speculating.

CONFIRMED FACTS:
${factsText}

OPEN ACTIONS:
${actionsText}

PEOPLE:
${contactsText}

RECENT MEETINGS (most recent first):
${historyText}`,
      messages: [{ role: "user", content: "Write the briefing." }],
    });

    const brief = response.content.find((b) => b.type === "text")?.text ?? "No brief generated.";
    return Response.json({ brief });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
