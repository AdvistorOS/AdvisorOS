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

Write in these sections with clear headers:

CONSISTENT STRENGTHS — what they reliably do well, with evidence across meetings
RECURRING WEAKNESSES — patterns that keep costing them, stated plainly and specifically
WHAT CORRELATES WITH SUCCESS — what's different about the meetings that went best
ONE THING TO CHANGE — the single highest-impact habit to work on next

Be direct and specific. Reference actual patterns you can see in the data, not generic sales
advice. If the data doesn't support a confident claim, say so rather than inventing a pattern.
Do not soften genuine weaknesses — this is only useful if it's honest.

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
