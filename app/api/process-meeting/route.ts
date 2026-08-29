import { AssemblyAI } from "assemblyai";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";

const aai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const { meetingId } = await req.json();

  const { data: meeting } = await supabaseAdmin
    .from("meetings").select("*, clients(*)").eq("id", meetingId).single();

  // 1. Transcribe with speaker labels
  const transcript = await aai.transcripts.transcribe({
    audio: meeting.media_url,
    speaker_labels: true,
  });
  await supabaseAdmin.from("transcripts").insert({
    meeting_id: meetingId,
    full_text: transcript.text,
    utterances: transcript.utterances,
  });

  // 2. Extract structured facts + internal sentiment
  const extraction = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `Extract structured wealth-management facts (income, objectives,
attitude_to_risk, action_items) from this transcript, AND a separate
client_sentiment object (overall_satisfaction, dissatisfaction_signals,
suggested_actions) based only on what was explicitly said — no speculation.
Respond with ONLY valid JSON, no markdown fences.`,
    messages: [{ role: "user", content: transcript.text }],
  });
  const facts = JSON.parse(extraction.content.find((b) => b.type === "text")!.text);

  await supabaseAdmin.from("extracted_facts").insert({ meeting_id: meetingId, category: "facts", payload: facts });
  if (facts.client_sentiment) {
    await supabaseAdmin.from("internal_notes").insert({ meeting_id: meetingId, type: "sentiment", payload: facts.client_sentiment });
  }

  // 3. Client-safe summary — saved in-app, never emailed
  const summaryResp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: "Write a short, neutral, plain-English summary of this meeting for the client's own records. Topics discussed and agreed next steps only.",
    messages: [{ role: "user", content: transcript.text }],
  });
  const summary = summaryResp.content.find((b) => b.type === "text")!.text;

  await supabaseAdmin.from("meetings").update({ status: "done", client_summary: summary }).eq("id", meetingId);

  return Response.json({ ok: true });
}
