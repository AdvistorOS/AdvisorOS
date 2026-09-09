import { ownedMeeting } from "@/lib/processing/access";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const access = await ownedMeeting(body?.meetingId);
  if (access.error) return access.error;
  const meetingId = access.meeting.id;
  const { data: transcript } = await supabaseAdmin.from("transcripts").select("full_text").eq("meeting_id", meetingId).single();
  const { data: meeting } = await supabaseAdmin.from("meetings").select("*, clients(full_name)").eq("id", meetingId).single();

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: "Write a formal internal file note for a UK wealth management adviser's records, based on this client meeting transcript. Professional, factual, third person. Include date placeholder, topics discussed, and agreed next steps. This is a draft for the adviser to review, not a final regulatory document.",
    messages: [{ role: "user", content: `Client: ${meeting?.clients?.full_name}\n\nTranscript:\n${transcript?.full_text ?? ""}` }],
  });
  const text = resp.content.find((b) => b.type === "text")!.text;
  return Response.json({ text });
}
