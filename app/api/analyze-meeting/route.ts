import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { meetingId, prompt } = await req.json();
  if (!meetingId || !prompt) return Response.json({ error: "meetingId and prompt required" }, { status: 400 });

  const { data: meeting } = await supabaseAdmin.from("meetings").select("id, adviser_id").eq("id", meetingId).single();
  if (!meeting || meeting.adviser_id !== user.id) return Response.json({ error: "not found" }, { status: 404 });

  const { data: transcriptRow } = await supabaseAdmin
    .from("transcripts").select("full_text").eq("meeting_id", meetingId).order("id", { ascending: false }).limit(1).maybeSingle();
  const transcriptText = transcriptRow?.full_text ?? "";
  if (!transcriptText) return Response.json({ error: "no transcript available for this meeting" }, { status: 400 });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: `You are analyzing a meeting transcript based on a specific request from the
adviser who ran it. Give a thorough, well-organized answer — use clear structure (headers or
bullet points where it helps readability), cite specific things said in the transcript, and
don't pad with generic commentary. If the request has multiple parts, address each clearly.
Base everything only on what's actually in the transcript below — do not invent information.

Transcript:
${transcriptText}`,
      messages: [{ role: "user", content: prompt }],
    });

    const result = response.content.find((b) => b.type === "text")?.text ?? "No analysis generated.";
    await supabaseAdmin.from("meeting_custom_analyses").insert({ meeting_id: meetingId, prompt, result });
    return Response.json({ result });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
