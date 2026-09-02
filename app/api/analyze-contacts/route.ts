import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function stripFences(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

export async function POST(req: Request) {
  const { meetingId } = await req.json();
  if (!meetingId) return Response.json({ error: "meetingId required" }, { status: 400 });

  const { data: transcriptRow } = await supabaseAdmin
    .from("transcripts").select("utterances").eq("meeting_id", meetingId).order("id", { ascending: false }).limit(1).maybeSingle();
  const utterances = (transcriptRow?.utterances as any[]) ?? [];
  if (!utterances.length) return Response.json({ error: "no transcript utterances found" }, { status: 400 });

  const { data: attendees } = await supabaseAdmin
    .from("meeting_attendees")
    .select("contact_id, speaker_label, contacts(id, full_name)")
    .eq("meeting_id", meetingId)
    .not("speaker_label", "is", null);

  if (!attendees?.length) return Response.json({ ok: true, skipped: "no mapped attendees" });

  const results: any[] = [];

  for (const attendee of attendees) {
    const speakerText = utterances
      .filter((u) => u.speaker === attendee.speaker_label)
      .map((u) => u.text)
      .join(" ");
    if (speakerText.trim().length < 10) continue;

    const { data: existingProfile } = await supabaseAdmin
      .from("contact_profiles").select("category, data")
      .eq("contact_id", attendee.contact_id).is("superseded_by", null);
    const knownText = (existingProfile ?? [])
      .map((p: any) => `${p.category}: ${JSON.stringify(p.data)}`).join("\n") || "No prior profile — this is the first meeting on record for this person.";

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: `You are analyzing what one specific person said during a business meeting, to
build a running profile of them for the person meeting with them. Here's what's already known
about them from previous meetings:

${knownText}

Based on ONLY what this person actually said in today's meeting (below), output raw JSON,
nothing else, no markdown fences:

{
  "emotional_tone": "e.g. positive, frustrated, cautious, enthusiastic — one or two words",
  "motives": ["short phrases on what seems to drive or matter to this person"],
  "concerns": ["short phrases on worries or objections they raised, if any"],
  "follow_ups": ["specific things to follow up on with this person"],
  "notable_quotes": ["at most 2 short, genuinely telling things they said"]
}

Base this entirely on what they actually said — do not invent or assume. If something isn't
evidenced in what they said, leave that array empty rather than guessing.`,
        messages: [{ role: "user", content: speakerText }],
      });

      const rawText = response.content.find((b) => b.type === "text")!.text;
      const profileData = JSON.parse(stripFences(rawText));

      const { data: previous } = await supabaseAdmin
        .from("contact_profiles").select("id").eq("contact_id", attendee.contact_id)
        .eq("category", "profile").is("superseded_by", null).maybeSingle();

      const { data: newProfile } = await supabaseAdmin.from("contact_profiles").insert({
        contact_id: attendee.contact_id, category: "profile", data: profileData, source_meeting_id: meetingId,
      }).select().single();

      if (previous && newProfile) {
        await supabaseAdmin.from("contact_profiles").update({ superseded_by: newProfile.id }).eq("id", previous.id);
      }

      results.push({ contact: (attendee.contacts as any)?.full_name, ok: true });
    } catch (e: any) {
      results.push({ contact: (attendee.contacts as any)?.full_name, ok: false, error: e.message });
    }
  }

  return Response.json({ ok: true, results });
}
