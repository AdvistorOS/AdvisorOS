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
    .from("meetings").select("id, client_id, created_at").eq("id", meetingId).single();
  if (!meeting) return Response.json({ error: "not found" }, { status: 404 });

  const { data: t } = await supabaseAdmin
    .from("transcripts").select("full_text, utterances").eq("meeting_id", meetingId)
    .order("id", { ascending: false }).limit(1).maybeSingle();

  const utterances = (t?.utterances as any[]) ?? [];
  const transcript = utterances.length
    ? utterances.map((u: any) => `[${fmt(u.start)}] Speaker ${u.speaker}: ${u.text}`).join("\n")
    : (t?.full_text ?? "");
  if (!transcript) return Response.json({ error: "no transcript" }, { status: 400 });

  // Everything currently known about this client, with dates
  const { data: known } = await supabaseAdmin
    .from("intelligence_objects")
    .select("id, object_type, label, value, temporal_status, created_at, contact_id")
    .eq("client_id", meeting.client_id)
    .neq("temporal_status", "superseded")
    .order("created_at", { ascending: false })
    .limit(60);

  const knownText = (known ?? []).length
    ? (known ?? []).map((k) =>
        `[id:${k.id}] (${new Date(k.created_at).toLocaleDateString()}) ${k.object_type} — ${k.label}: ${k.value}`
      ).join("\n")
    : "Nothing on record yet — this is the first meeting for this client.";

  // Map speaker labels to real people
  const { data: attendees } = await supabaseAdmin
    .from("meeting_attendees")
    .select("contact_id, speaker_label, contacts(full_name, participant_type)")
    .eq("meeting_id", meetingId);

  const speakerMap = (attendees ?? [])
    .filter((a) => a.speaker_label)
    .map((a) => `Speaker ${a.speaker_label} = ${(a.contacts as any)?.full_name} (${(a.contacts as any)?.participant_type ?? "client"})`)
    .join("\n") || "Speakers not yet identified.";

  const contactIdByLabel: Record<string, string> = {};
  for (const a of attendees ?? []) {
    if (a.speaker_label && a.contact_id) contactIdByLabel[a.speaker_label] = a.contact_id;
  }

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3500,
      system: `You maintain an evolving record of a business relationship across many meetings.
Your job is to compare what was said in today's meeting against what is already known, and
identify what is genuinely NEW, CHANGED, CONFIRMED, or now RESOLVED.

WHAT IS ALREADY ON RECORD (with dates and ids):
${knownText}

WHO IS SPEAKING:
${speakerMap}

Output raw JSON only, no fences:

{
  "objects": [
    {
      "object_type": "position | objection | commitment | priority | concern | question | decision | fact",
      "speaker_label": "A | B | null — the letter of whoever said it, null if not attributable",
      "label": "Short name for this, under 8 words",
      "value": "What is now true, one clear sentence",
      "temporal_status": "new | changed | confirmed | resolved | escalating | contradicted | unresolved",
      "supersedes_id": "The [id:...] value from the record above that this replaces, or null",
      "change_description": "If changed/contradicted: what it was before and what it is now. Empty string otherwise.",
      "evidence_quote": "The words that support this, under 25 words",
      "evidence_timestamp": "mm:ss",
      "confidence": "high | medium | low"
    }
  ]
}

Rules that matter:
- Only mark "changed" or "contradicted" when it genuinely differs from what's on record — cite the
  prior id in supersedes_id.
- "confirmed" means they restated something already known without changing it. Use it sparingly —
  only when it genuinely matters that they reaffirmed it.
- "resolved" means a previously open concern or question has been settled.
- Attribute to the speaker who actually said it. If speakers aren't identified, use null.
- Maximum 12 objects. Prioritise genuine relationship movement over routine detail.
- Never invent a change to appear insightful. If the meeting genuinely covered nothing new, return
  a short list or an empty array.
- Every object needs a real quote and real timestamp from the transcript.`,
      messages: [{ role: "user", content: transcript }],
    });

    if (res.stop_reason === "max_tokens") {
      return Response.json({ error: "Response truncated — retry." }, { status: 500 });
    }

    const parsed = JSON.parse(stripFences(res.content.find((b) => b.type === "text")!.text));
    const objects = parsed.objects ?? [];

    // Don't duplicate on re-run
    await supabaseAdmin.from("intelligence_objects").delete().eq("meeting_id", meetingId);

    let superseded = 0;
    for (const o of objects) {
      const { data: inserted } = await supabaseAdmin.from("intelligence_objects").insert({
        client_id: meeting.client_id,
        contact_id: o.speaker_label ? contactIdByLabel[o.speaker_label] ?? null : null,
        meeting_id: meetingId,
        object_type: o.object_type,
        label: o.label,
        value: o.value,
        temporal_status: o.temporal_status,
        supersedes_id: o.supersedes_id || null,
        evidence_quote: o.evidence_quote,
        evidence_timestamp: o.evidence_timestamp,
        evidence_speaker: o.speaker_label || null,
        confidence: o.confidence,
        validation_status: "ai_inferred",
      }).select().single();

      if (o.supersedes_id && inserted) {
        const { error } = await supabaseAdmin.from("intelligence_objects")
          .update({ temporal_status: "superseded" }).eq("id", o.supersedes_id);
        if (!error) superseded++;
      }
    }

    return Response.json({ ok: true, created: objects.length, superseded });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
