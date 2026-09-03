import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function getScore(v: any): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && typeof v.score === "number") return v.score;
  return null;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { data: me } = await supabaseAdmin
    .from("advisers").select("id, role, firm_id").eq("id", user.id).single();
  if (me?.role !== "manager") return Response.json({ error: "not authorized" }, { status: 403 });

  const { data: members } = await supabaseAdmin
    .from("advisers").select("id, full_name").eq("firm_id", me.firm_id);
  const ids = (members ?? []).map((m) => m.id);

  const { data: meetings } = await supabaseAdmin
    .from("meetings").select("id, adviser_id").in("adviser_id", ids).eq("status", "done");
  const { data: factsRows } = await supabaseAdmin
    .from("extracted_facts").select("meeting_id, payload").in("meeting_id", (meetings ?? []).map((m) => m.id));

  const factsBy: Record<string, any> = {};
  for (const f of factsRows ?? []) factsBy[f.meeting_id] = f.payload;

  const digest = (members ?? []).map((m) => {
    const theirs = (meetings ?? []).filter((mt) => mt.adviser_id === m.id);
    const skills: Record<string, number[]> = {};
    for (const mt of theirs) {
      const f = factsBy[mt.id];
      if (!f?.scorecard) continue;
      for (const [k, v] of Object.entries(f.scorecard)) {
        const s = getScore(v);
        if (s === null) continue;
        if (!skills[k]) skills[k] = [];
        skills[k].push(s);
      }
    }
    const avgs = Object.entries(skills)
      .map(([k, arr]) => `${k}: ${(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)}`)
      .join(", ");
    return `${m.full_name} — ${theirs.length} meetings. ${avgs || "no scored meetings"}`;
  }).join("\n");

  if (!meetings?.length) {
    return Response.json({ insights: "No completed meetings across the team yet." });
  }

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: `You are advising a sales manager on their team. Be direct and specific — this is
for a manager deciding where to spend coaching time.

Use these headers:

TEAM PATTERN
- One bullet: what the whole team consistently does well or badly

WHO NEEDS COACHING
- One bullet per adviser who needs attention, naming them and the specific skill

WHO TO LEARN FROM
- One bullet: the strongest performer and what specifically they do well

MANAGER ACTION
- One bullet: the single most useful thing this manager could do next

Short punchy bullets, max 20 words each. Name real people and cite real numbers. If the data
doesn't support a claim, write "not enough data yet" rather than inventing one.

TEAM DATA:
${digest}`,
      messages: [{ role: "user", content: "What should I focus on as a manager?" }],
    });

    const insights = res.content.find((b) => b.type === "text")?.text ?? "";
    return Response.json({ insights });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
