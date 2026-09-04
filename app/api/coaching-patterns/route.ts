import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function stripFences(t: string) {
  return t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

function getScore(v: any): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && typeof v.score === "number") return v.score;
  return null;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { data: meetings } = await supabaseAdmin
    .from("meetings").select("id, created_at, objective, client_id, clients(full_name)")
    .eq("adviser_id", user.id).eq("status", "done")
    .order("created_at", { ascending: false }).limit(20);

  if (!meetings || meetings.length < 3) {
    return Response.json({
      analysis: null,
      message: `Coaching needs at least 3 completed meetings. You have ${meetings?.length ?? 0}.`,
    });
  }

  const ids = meetings.map((m) => m.id);

  const [{ data: factsRows }, { data: momentRows }, { data: attendeeRows }] = await Promise.all([
    supabaseAdmin.from("extracted_facts").select("meeting_id, payload").in("meeting_id", ids),
    supabaseAdmin.from("meeting_moments").select("meeting_id, payload").in("meeting_id", ids),
    supabaseAdmin.from("meeting_attendees").select("meeting_id, speaker_label, contacts(full_name, participant_type)").in("meeting_id", ids),
  ]);

  const factsBy: Record<string, any> = {};
  for (const f of factsRows ?? []) factsBy[f.meeting_id] = f.payload;
  const momentsBy: Record<string, any> = {};
  for (const m of momentRows ?? []) momentsBy[m.meeting_id] = m.payload;

  const userIdentified = (attendeeRows ?? []).some((a: any) => a.contacts?.participant_type === "user");

  // Split into recent vs previous for trend measurement
  const half = Math.floor(meetings.length / 2);
  const recent = meetings.slice(0, half || 1);
  const previous = meetings.slice(half || 1);

  function periodStats(list: any[]) {
    const skills: Record<string, number[]> = {};
    let objAchieved = 0, objAssessed = 0;
    const momentCounts: Record<string, number> = { brilliant: 0, good: 0, missed: 0, mistake: 0, blunder: 0 };
    for (const m of list) {
      const f = factsBy[m.id];
      if (f?.scorecard) {
        for (const [k, v] of Object.entries(f.scorecard)) {
          const s = getScore(v);
          if (s === null) continue;
          (skills[k] ??= []).push(s);
        }
      }
      const a = f?.objective_assessment?.achieved;
      if (a === "yes") { objAchieved++; objAssessed++; }
      else if (a === "partially" || a === "no") objAssessed++;
      const mo = momentsBy[m.id];
      for (const x of mo?.moments ?? []) {
        if (momentCounts[x.classification] !== undefined) momentCounts[x.classification]++;
      }
    }
    const avgs: Record<string, number> = {};
    for (const [k, arr] of Object.entries(skills)) {
      avgs[k] = Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
    }
    return { avgs, objAchieved, objAssessed, momentCounts, count: list.length };
  }

  const recentStats = periodStats(recent);
  const prevStats = periodStats(previous);

  const evidence = meetings.map((m: any) => {
    const f = factsBy[m.id] ?? {};
    const mo = momentsBy[m.id];
    const sc = f.scorecard ?? {};
    const scoreLine = Object.entries(sc)
      .map(([k, v]) => {
        const s = getScore(v);
        const reason = (v as any)?.reason;
        return s !== null ? `${k}=${s}${reason ? ` (${reason})` : ""}` : null;
      })
      .filter(Boolean).join("; ");
    const moments = (mo?.moments ?? []).map((x: any) =>
      `${x.classification} at ${x.time}: ${x.what_happened} | why: ${x.why_it_mattered}${x.better_approach ? ` | better: ${x.better_approach}` : ""}${x.excerpt ? ` | said: "${x.excerpt}"` : ""}`
    ).join("\n    ");
    return `MEETING ${m.id} — ${(m.clients as any)?.full_name ?? "?"} — ${new Date(m.created_at).toLocaleDateString()}
  Objective: ${m.objective ?? "none"} → ${f.objective_assessment?.achieved ?? "not assessed"}
  Scores: ${scoreLine || "none"}
  Moments:
    ${moments || "none analysed"}`;
  }).join("\n\n");

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: `You are a sales coach analysing ONE salesperson's real meetings. ${userIdentified
        ? "Speakers have been identified — judge only the salesperson's contributions."
        : "Speakers are not fully identified. Infer the salesperson from context: they ask discovery questions and present solutions. Never attribute client statements to them."}

Output raw JSON only, no fences:

{
  "priorities": [
    {
      "title": "The pattern, under 8 words",
      "occurrences": "e.g. 3 of the last 6 relevant meetings",
      "pattern": "What they consistently do, two sentences",
      "why_it_matters": "The concrete cost of this, two sentences",
      "evidence": [
        { "meeting_id": "real id", "client": "name", "date": "date", "timestamp": "mm:ss", "what_happened": "One sentence" }
      ],
      "client_response": "What the client did in response where observable, or empty string",
      "do_differently": "Specific behavioural change, two sentences",
      "better_language": "An actual sentence they could say instead",
      "trend": "improving | worsening | steady | insufficient_data"
    }
  ],
  "strengths": [
    {
      "title": "The strength, under 8 words",
      "occurrences": "e.g. 7 examples across 5 meetings",
      "impact": "What measurably followed when they did this",
      "evidence": [
        { "meeting_id": "real id", "client": "name", "date": "date", "timestamp": "mm:ss", "what_happened": "One sentence" }
      ],
      "why_it_works": "Two sentences",
      "trend": "improving | worsening | steady | insufficient_data"
    }
  ],
  "training_plan": {
    "next_meeting_focus": "One specific behaviour to focus on in the very next meeting",
    "measurable_challenge": "Something concrete and countable to attempt",
    "review_these": [ { "meeting_id": "real id", "timestamp": "mm:ss", "why": "What to notice when reviewing this" } ]
  }
}

Hard rules:
- Maximum 3 priorities and 3 strengths.
- Only call something a pattern with evidence from at least 2 different meetings. If nothing
  qualifies, return fewer items or empty arrays — never manufacture a pattern.
- Every evidence entry must use a real meeting_id and a real timestamp from the data below.
- Never invent quotes or timestamps.
- Set trend to "insufficient_data" unless you can genuinely see change across periods.
- Be direct about weaknesses. Soft coaching is useless coaching.

MEETING EVIDENCE (most recent first):
${evidence}`,
      messages: [{ role: "user", content: "Analyse my coaching patterns." }],
    });

    if (res.stop_reason === "max_tokens") {
      return Response.json({ error: "Response truncated — retry." }, { status: 500 });
    }

    const analysis = JSON.parse(stripFences(res.content.find((b) => b.type === "text")!.text));

    await supabaseAdmin.from("coaching_patterns").delete().eq("adviser_id", user.id);
    await supabaseAdmin.from("coaching_patterns").insert({
      adviser_id: user.id,
      pattern_type: "full_analysis",
      title: "Coaching analysis",
      payload: { analysis, recentStats, prevStats },
      period_end: new Date().toISOString(),
    });

    return Response.json({
      analysis,
      metrics: { recent: recentStats, previous: prevStats },
      meetingCount: meetings.length,
      userIdentified,
    });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
