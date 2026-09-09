import { ownedMeeting } from "@/lib/processing/access";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const access = await ownedMeeting(body?.meetingId);
  if (access.error) return access.error;
  const meetingId = access.meeting.id;
  const { data: meeting } = await supabaseAdmin.from("meetings").select("*, clients(full_name)").eq("id", meetingId).single();

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: "Write a short, warm, professional follow-up email from a wealth adviser to their client after a meeting, based on this summary. Include next steps mentioned. This is a draft for the adviser to review and send themselves.",
    messages: [{ role: "user", content: `Client: ${meeting?.clients?.full_name}\n\nMeeting summary:\n${meeting?.client_summary ?? ""}` }],
  });
  const text = resp.content.find((b) => b.type === "text")!.text;
  return Response.json({ text });
}
