import { AssemblyAI } from "assemblyai";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";

const aai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const { meetingId } = await req.json();

  try {
    const { data: meeting, error: meetingFetchErr } = await supabaseAdmin
      .from("meetings").select("*, clients(*)").eq("id", meetingId).single();
    if (meetingFetchErr || !meeting) {
      return Response.json({ step: "fetch meeting", error: meetingFetchErr?.message ?? "not found" }, { status: 500 });
    }

    let transcript;
    try {
      transcript = await aai.transcripts.transcribe({
        audio: meeting.media_url,
        speaker_labels: true,
      });
    } catch (e: any) {
      return Response.json({ step: "assemblyai transcribe", error: e.message }, { status: 500 });
    }

    if (transcript.status === "error") {
      return Response.json({ step: "assemblyai transcribe status", error: transcript.error }, { status: 500 });
    }

    const transcriptText = transcript.text ?? "";

    const { error: transcriptInsertErr } = await supabaseAdmin.from("transcripts").insert({
      meeting_id: meetingId,
      full_text: transcriptText,
      utterances: transcript.utterances,
    });
    if (transcriptInsertErr) {
      return Response.json({ step: "insert transcript", error: transcriptInsertErr.message }, { status: 500 });
    }

    let facts;
    try {
      const extraction = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: `Extract structured wealth-management facts (income, objectives,
attitude_to_risk, action_items) from this transcript, AND a separate
client_sentiment object (overall_satisfaction, dissatisfaction_signals,
suggested_actions) based only on what was explicitly said — no speculation.
Respond with ONLY valid JSON, no markdown fences.`,
        messages: [{ role: "user", content: transcriptText }],
      });
      const rawText = extraction.content.find((b) => b.type === "text")!.text;
      facts = JSON.parse(rawText);
    } catch (e: any) {
      return Response.json({ step: "anthropic extraction", error: e.message }, { status: 500 });
    }

    const { error: factsInsertErr } = await supabaseAdmin.from("extracted_facts").insert({ meeting_id: meetingId, category: "facts", payload: facts });
    if (factsInsertErr) {
      return Response.json({ step: "insert extracted_facts", error: factsInsertErr.message }, { status: 500 });
    }

    if (facts.client_sentiment) {
      const { error: notesErr } = await supabaseAdmin.from("internal_notes").insert({ meeting_id: meetingId, type: "sentiment", payload: facts.client_sentiment });
      if (notesErr) {
        return Response.json({ step: "insert internal_notes", error: notesErr.message }, { status: 500 });
      }
    }

    let summary;
    try {
      const summaryResp = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: "Write a short, neutral, plain-English summary of this meeting for the client's own records. Topics discussed and agreed next steps only.",
        messages: [{ role: "user", content: transcriptText }],
      });
      summary = summaryResp.content.find((b) => b.type === "text")!.text;
    } catch (e: any) {
      return Response.json({ step: "anthropic summary", error: e.message }, { status: 500 });
    }

    const { error: updateErr } = await supabaseAdmin.from("meetings").update({ status: "done", client_summary: summary }).eq("id", meetingId);
    if (updateErr) {
      return Response.json({ step: "update meeting", error: updateErr.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ step: "unexpected", error: e.message ?? String(e) }, { status: 500 });
  }
}
