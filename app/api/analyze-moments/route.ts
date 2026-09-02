import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function stripFences(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { meetingId } = await req.json();
  if (!meetingId) return Response.json({ error: "meetingId required" }, { status: 400 });

  const { data: meeting } = await supabaseAdmin
    .from("meetings").select("id, adviser_id, objective").eq("id", meetingId).single();
  if (!meeting || meeting.adviser_id !== user.id) return Response.json({ error: "not found" }, { status: 404 });

  const { data: transcriptRow } = await supabaseAdmin
    .from("transcripts").select("full_text, utterances").eq("meeting_id", meetingId)
    .order("id", { ascending: false }).limit(1).maybeSingle();

  const utterances = (transcriptRow?.utterances as any[]) ?? [];
  const transcriptText = transcriptRow?.full_text ?? "";
  if (!transcriptText) return Response.json({ error: "no transcript available" }, { status: 400 });

  const timestamped = utterances.length
    ? utterances.map((u: any) => `[${formatTime(u.start)}] Speaker ${u.speaker}: ${u.text}`).join("\n")
    : transcriptText;

  const objectiveLine = meeting.objective?.trim()
    ? `The objective of this meeting was: "${meeting.objective.trim()}"`
    : "No specific objective was set for this meeting.";

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: `You are a sales coach reviewing a meeting transcript. ${objectiveLine}

Identify the genuinely pivotal moments — the specific things the adviser said (or failed to say)
that changed the direction of the conversation, for better or worse.

Output raw JSON only, no markdown fences:

{
  "moments": [
    {
      "time": "mm:ss",
      "classification": "brilliant | good | missed | mistake | blunder",
      "what_happened": "One sentence on what the adviser did at this point",
      "why_it_mattered": "One or two sentences on the effect it had on the conversation",
      "better_approach": "For missed/mistake/blunder only: what would have worked better. Empty string for brilliant/good.",
      "excerpt": "A short quote or close paraphrase from the transcript at this moment, under 25 words"
    }
  ],
  "headline": "One sentence summarising the single most important coaching takeaway from this meeting"
}

Rules: use REAL timestamps from the transcript, never invent them. Maximum 6 moments — only
genuinely pivotal ones, not a running commentary. Be honest: if the adviser handled something
poorly, say so plainly and classify it accurately. If a meeting was genuinely well-run, it's fine
for most moments to be positive — but do not manufacture praise. Judge only the adviser's
contributions, not the client's. Output ONLY the JSON object, complete and valid.`,
      messages: [{ role: "user", content: timestamped }],
    });

    if (response.stop_reason === "max_tokens") {
      return Response.json({ error: "Response cut off — try again." }, { status: 500 });
    }

    const raw = response.content.find((b) => b.type === "text")!.text;
    const payload = JSON.parse(stripFences(raw));

    await supabaseAdmin.from("meeting_moments").delete().eq("meeting_id", meetingId);
    await supabaseAdmin.from("meeting_moments").insert({ meeting_id: meetingId, payload });

    return Response.json({ ok: true, payload });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
