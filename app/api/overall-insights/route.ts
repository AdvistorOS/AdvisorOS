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
    .from("meetings").select("id, created_at, objective, client_id")
    .eq("adviser_id", user.id).eq("status", "done").order("created_at");

  if (!meetings || meetings.length < 3) {
    return Response.json({ insights: null, message: `Insights need at least 3 completed meetings. You have ${meetings?.length ?? 0}.` });
  }

  const { data: factsRows } = await supabaseAdmin
    .from("extracted_facts").select("meeting_id, payload").in("meeting_id", meetings.map((m) => m.id));
  const factsBy: Record<string, any> = {};
  for (const f of factsRows ?? []) factsBy[f.meeting_id] = f.payload;

  const { data: clients } = await supabaseAdmin
    .from("clients").select("id, full_name, sales_stage").eq("adviser_id", user.id);

  const scoreTotals: Record<string, { sum: number; count: number }> = {};
  let achieved = 0, partial = 0, missed = 0;
  const sentimentCounts: Record<string, number> = { positive: 0, neutral: 0, unhappy: 0 };
  const perClient: Record<string, number[]> = {};

  for (const m of meetings) {
    const f = factsBy[m.id];
    if (!f) continue;
    const a = f.objective_assessment?.achieved;
    if (a === "yes") achieved++; else if (a === "partially") partial++; else if (a === "no") missed++;
    const s = f.client_sentiment?.overall_satisfaction;
    if (s && sentimentCounts[s] !== undefined) sentimentCounts[s]++;
    for (const [k, v] of Object.entries(f.scorecard ?? {})) {
      if (typeof v !== "number") continue;
      if (!scoreTotals[k]) scoreTotals[k] = { sum: 0, count: 0 };
      scoreTotals[k].sum += v; scoreTotals[k].count++;
    }
    if (typeof f.scorecard?.overall === "number") {
      if (!perClient[m.client_id]) perClient[m.client_id] = [];
      perClient[m.client_id].push(f.scorecard.overall);
    }
  }

  const avgScores = Object.entries(scoreTotals)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${(v.sum / v.count).toFixed(1)}/10`)
    .join("\n");

  const clientTrends = Object.entries(perClient).map(([cid, scores]) => {
    const name = clients?.find((c) => c.id === cid)?.full_name ?? "Unknown";
    const stage = clients?.find((c) => c.id === cid)?.sales_stage ?? "no stage";
    const trend = scores.length >= 2 ? (scores[scores.length - 1] - scores[0]) : 0;
    return `${name} (${stage}): ${scores.length} meetings, avg ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)}, trend ${trend > 0 ? "+" : ""}${trend}`;
  }).join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      system: `You are analysing an adviser's overall performance across all their clients.
Give practical, specific improvement advice — not generic sales platitudes.

Format EXACTLY like this, nothing else:

BIGGEST OPPORTUNITY
- One bullet, max 20 words: the single change that would most improve results, based on the data

WEAKEST AREA
- One bullet, max 15 words: the lowest-scoring skill and what it's costing them

CLIENT ATTENTION
- Max 2 bullets, max 15 words each: which specific clients need attention and why

QUICK WINS
- Max 2 bullets, max 12 words each: small changes with immediate impact

Every bullet must be short and punchy — no clauses, no preamble. Reference real numbers and
client names from the data. If the data doesn't support a claim, write "not enough evidence yet"
for that section instead of inventing one.

DATA (${meetings.length} completed meetings):

Average scores by area:
${avgScores}

Objectives: ${achieved} achieved, ${partial} partial, ${missed} missed
Client sentiment: ${sentimentCounts.positive} positive, ${sentimentCounts.neutral} neutral, ${sentimentCounts.unhappy} unhappy

Per client:
${clientTrends}`,
      messages: [{ role: "user", content: "What should this adviser improve?" }],
    });

    const insights = response.content.find((b) => b.type === "text")?.text ?? "No insights generated.";
    return Response.json({ insights, meetingCount: meetings.length });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
