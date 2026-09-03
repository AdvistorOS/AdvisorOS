import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function stripFences(t: string) {
  return t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export async function POST(req: Request) {
  const { meetingId } = await req.json();
  if (!meetingId) return Response.json({ error: "meetingId required" }, { status: 400 });

  const { data: meeting } = await supabaseAdmin
    .from("meetings").select("id, adviser_id").eq("id", meetingId).single();
  if (!meeting) return Response.json({ error: "not found" }, { status: 404 });

  const { data: t } = await supabaseAdmin
    .from("transcripts").select("full_text, utterances").eq("meeting_id", meetingId)
    .order("id", { ascending: false }).limit(1).maybeSingle();

  const utterances = (t?.utterances as any[]) ?? [];
  const text = utterances.length
    ? utterances.map((u: any) => `[${fmt(u.start)}] Speaker ${u.speaker}: ${u.text}`).join("\n")
    : (t?.full_text ?? "");

  if (!text) return Response.json({ error: "no transcript" }, { status: 400 });

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: `Review this meeting transcript for language a compliance manager would want to know about.

Output raw JSON only, no fences:

{
  "flags": [
    {
      "severity": "low | medium | high",
      "category": "unprofessional | pressure_tactics | misleading_claim | inappropriate | confidentiality | regulatory_risk",
      "quote": "The actual words said, under 25 words",
      "context": "One sentence on why this is a concern",
      "timestamp_label": "mm:ss"
    }
  ]
}

Flag only genuine concerns: guarantees about returns, pressure or urgency tactics, dismissive or
unprofessional language toward the client, misleading statements, discussing other clients'
information, or anything creating regulatory exposure.

Do NOT flag: normal sales enthusiasm, casual conversation, mild informality, or disagreement
handled professionally. If nothing genuine, return an empty flags array. Never invent concerns
to appear thorough — an empty array is the correct answer for a clean meeting.

Judge only the ADVISER's language, not the client's. Use real timestamps.`,
      messages: [{ role: "user", content: text }],
    });

    const raw = res.content.find((b) => b.type === "text")!.text;
    const parsed = JSON.parse(stripFences(raw));

    await supabaseAdmin.from("language_flags").delete().eq("meeting_id", meetingId);
    if (parsed.flags?.length) {
      await supabaseAdmin.from("language_flags").insert(
        parsed.flags.map((f: any) => ({
          meeting_id: meetingId,
          adviser_id: meeting.adviser_id,
          severity: f.severity,
          category: f.category,
          quote: f.quote,
          context: f.context,
          timestamp_label: f.timestamp_label,
        }))
      );
    }
    return Response.json({ ok: true, count: parsed.flags?.length ?? 0 });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
