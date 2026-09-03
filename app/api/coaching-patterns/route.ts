import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { data: meetings } = await supabaseAdmin
    .from("meetings").select("id, created_at, objective")
    .eq("adviser_id", user.id).eq("status", "done")
    .order("created_at", { ascending: false }).limit(20);

  if (!meetings || meetings.length < 3) {
    return Response.json({
      patterns: null,
      message: `Coaching patterns need at least 3 completed meetings to be meaningful. You have ${meetings?.length ?? 0}.`,
    });
  }

  const ids = meetings.map((m) => m.id);
  const { data: factsRows } = await supabaseAdmin
    .from("extracted_facts").select("meeting_id, payload").in("meeting_id", ids);
  const { data: momentRows } = await supabaseAdmin
    .from("meeting_moments").select("meeting_id, payload").in("meeting_id", ids);

  const factsBy: Record<string, any> = {};
  for (const f of factsRows ?? []) factsBy[f.meeting_id] = f.payload;
  const momentsBy: Record<string, any> = {};
  for (const m of momentRows ?? []) momentsBy[m.meeting_id] = m.payload;

  const digest = meetings.map((m: any, i: number) => {
    const f = factsBy[m.id] ?? {};
    const mo = momentsBy[m.id];
    const sc = f.scorecard ?? {};
    const scoreLine = Object.keys(sc).length
      ? `Scores — discovery ${sc.discovery}, questions ${sc.question_quality}, listening ${sc.listening}, objections ${sc.objection_handling}, commercial ${sc.commercial_positioning}, engagement ${sc.client_engagement}, next steps ${sc.next_step_clarity}, overall ${sc.overall}`
      : "No scorecard.";
    const objLine = m.objective
      ? `Objective "${m.objective}" — ${f.objective_assessment?.achieved ?? "not assessed"}`
      : "No objective set.";
    const momentLine = mo
      ? `Key moments: ${(mo.moments ?? []).map((x: any) => `${x.classification} (${x.what_happened})`).join("; ")}`
      : "No moment analysis.";
    return `Meeting ${i + 1} (${new Date(m.created_at).toLocaleDateString()}):\n${objLine}\n${scoreLine}\n${momentLine}`;
  }).join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      system: `You are a sales coach reviewing one adviser's performance across their recent
meetings. Identify genuine, repeated patterns — not one-off events.

Format matters — this must be scannable in 15 seconds, not read like an essay. Use this EXACT
structure, nothing else:

STRENGTHS
- One short bullet per strength, max 12 words each, max 3 bullets

WEAKNESSES
- One short bullet per weakness, max 12 words each, max 3 bullets

WHAT WORKS
- One short bullet on what correlates with your best meetings, max 15 words

FOCUS NEXT
- One single bullet: the highest-impact thing to change, max 20 words

Every bullet must be a short, punchy phrase, not a sentence with clauses. No preamble, no
"across your meetings I noticed" — start directly with the bullets. Reference real patterns
from the data below, never generic sales advice. If the data doesn't support a confident claim,
say "not enough evidence yet" for that section rather than inventing a pattern. Do not soften
genuine weaknesses.

MEETING HISTORY (${meetings.length} meetings, most recent first):
${digest}`,
      messages: [{ role: "user", content: "What patterns do you see across these meetings?" }],
    });

    const patterns = response.content.find((b) => b.type === "text")?.text ?? "No patterns generated.";
    return Response.json({ patterns, meetingCount: meetings.length });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
