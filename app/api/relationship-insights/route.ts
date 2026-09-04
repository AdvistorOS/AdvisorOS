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

  const { data: intel } = await supabaseAdmin
    .from("intelligence_objects")
    .select("object_type, label, value, temporal_status, confidence, contacts(full_name), meetings(created_at)")
    .eq("client_id", clientId)
    .neq("validation_status", "rejected")
    .order("created_at", { ascending: true });

  if (!intel?.length) {
    return Response.json({ insights: null, message: "No intelligence recorded yet. Rebuild intelligence on this client's meetings first." });
  }

  const timeline = intel.map((i: any) =>
    `${i.meetings?.created_at ? new Date(i.meetings.created_at).toLocaleDateString() : "?"} | [${i.temporal_status}] ${i.object_type} | ${i.contacts?.full_name ?? "unattributed"} | ${i.label}: ${i.value}`
  ).join("\n");

  const { count: meetingCount } = await supabaseAdmin
    .from("meetings").select("*", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "done");

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      system: `Analyse how this relationship with ${client.full_name} has developed across ${meetingCount ?? 0} meetings.

Use these headers exactly:

TRAJECTORY
- One bullet: is this relationship advancing, stalling, or deteriorating, and on what evidence

WHAT'S SHIFTED
- Bullets for genuine position changes, naming who changed and in which direction

STILL BLOCKING
- Bullets for anything unresolved that keeps recurring across meetings

WHO MATTERS
- One bullet per person on their apparent influence and current disposition

DO NEXT
- One bullet: the single highest-leverage move now

Short bullets, max 20 words. Name real people and cite dates. If the record doesn't support a
claim, write "not enough evidence yet" rather than inventing one. Do not soften genuine problems.

CHRONOLOGICAL RECORD:
${timeline}`,
      messages: [{ role: "user", content: "How is this relationship developing?" }],
    });

    return Response.json({ insights: res.content.find((b) => b.type === "text")?.text ?? "", meetingCount });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
