import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { clientId, question } = await req.json();
  if (!clientId || !question) return Response.json({ error: "clientId and question required" }, { status: 400 });

  const { data: client } = await supabaseAdmin.from("clients").select("id, full_name, adviser_id").eq("id", clientId).single();
  if (!client || client.adviser_id !== user.id) return Response.json({ error: "not found" }, { status: 404 });

  const { data: meetings } = await supabaseAdmin
    .from("meetings").select("id, created_at, client_summary, objective").eq("client_id", clientId).order("created_at");

  const { data: facts } = await supabaseAdmin
    .from("client_facts").select("category, data").eq("client_id", clientId).is("superseded_by", null);

  const { data: transcripts } = await supabaseAdmin
    .from("transcripts").select("meeting_id, full_text").in("meeting_id", (meetings ?? []).map((m) => m.id));

  const transcriptByMeeting: Record<string, string> = {};
  for (const t of transcripts ?? []) transcriptByMeeting[t.meeting_id] = t.full_text;

  const historyText = (meetings ?? []).map((m: any, i: number) => {
    const objectiveLine = m.objective ? `Objective: ${m.objective}` : "";
    const transcriptExcerpt = (transcriptByMeeting[m.id] ?? "").slice(0, 4000);
    return `--- Meeting ${i + 1} (${new Date(m.created_at).toLocaleDateString()}) ---\n${objectiveLine}\nSummary: ${m.client_summary ?? "N/A"}\nTranscript excerpt: ${transcriptExcerpt}`;
  }).join("\n\n");

  const factsText = (facts ?? []).map((f: any) => `${f.data.label}: ${f.data.value}`).join("\n") || "No confirmed facts on record.";

  const { data: intel } = await supabaseAdmin
    .from("intelligence_objects")
    .select("object_type, label, value, temporal_status, evidence_quote, contacts(full_name), meetings(created_at)")
    .eq("client_id", clientId)
    .neq("temporal_status", "superseded")
    .neq("validation_status", "rejected")
    .order("created_at", { ascending: false })
    .limit(50);

  const intelText = (intel ?? []).length
    ? (intel ?? []).map((i: any) =>
        `[${i.temporal_status}] ${i.object_type} — ${i.label}: ${i.value}` +
        (i.contacts?.full_name ? ` (said by ${i.contacts.full_name})` : "") +
        (i.meetings?.created_at ? ` on ${new Date(i.meetings.created_at).toLocaleDateString()}` : "") +
        (i.evidence_quote ? ` — "${i.evidence_quote}"` : "")
      ).join("\n")
    : "No structured intelligence recorded yet.";

  if (!meetings?.length) {
    return Response.json({ answer: "No meetings recorded yet for this client, so there's nothing to draw on." });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: `You are answering a question about a specific client, ${client.full_name}, based
entirely on their meeting history. Confirmed facts on record:

${factsText}

Tracked relationship intelligence (status-tagged, most recent first):

${intelText}

Full meeting history:

${historyText}

Answer the question directly and concisely, based only on what's actually in this history.
If the answer isn't clearly supported by the history, say so plainly rather than guessing.
Reference which meeting (by date) something came from where relevant.`,
      messages: [{ role: "user", content: question }],
    });

    const answer = response.content.find((b) => b.type === "text")?.text ?? "No answer generated.";
    return Response.json({ answer });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
