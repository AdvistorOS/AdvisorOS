import { AssemblyAI } from "assemblyai";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";

const aai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function stripFences(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

export async function POST(req: Request) {
  const { meetingId } = await req.json();

  try {
    const { data: meeting, error: meetingFetchErr } = await supabaseAdmin
      .from("meetings").select("*, clients(*)").eq("id", meetingId).single();
    if (meetingFetchErr || !meeting) {
      return Response.json({ step: "fetch meeting", error: meetingFetchErr?.message ?? "not found" }, { status: 500 });
    }

    // Pull everything already known about this client from prior approved meetings
    const { data: existingFacts } = await supabaseAdmin
      .from("client_facts")
      .select("category, data")
      .eq("client_id", meeting.client_id)
      .is("superseded_by", null);

    const knownFactsText = (existingFacts ?? [])
      .map((f: any) => `${f.data.label}: ${f.data.value}`)
      .join("\n") || "No prior information on file — this is the first recorded meeting.";

    await supabaseAdmin.from("meetings").update({ status: "transcribing" }).eq("id", meetingId);

    let transcript;
    try {
      transcript = await aai.transcripts.transcribe({ audio: meeting.media_url, speaker_labels: true });
    } catch (e: any) {
      await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
      return Response.json({ step: "assemblyai transcribe", error: e.message }, { status: 500 });
    }
    if (transcript.status === "error") {
      await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
      return Response.json({ step: "assemblyai transcribe status", error: transcript.error }, { status: 500 });
    }
    const transcriptText = transcript.text ?? "";

    if (transcriptText.trim().length < 10) {
      await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
      return Response.json({
        step: "empty transcript",
        error: "No speech was detected in this recording. Try a longer or clearer recording (at least a few sentences).",
      }, { status: 500 });
    }

    const { error: transcriptInsertErr } = await supabaseAdmin.from("transcripts").insert({
      meeting_id: meetingId, full_text: transcriptText, utterances: transcript.utterances,
    });
    if (transcriptInsertErr) {
      await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
      return Response.json({ step: "insert transcript", error: transcriptInsertErr.message }, { status: 500 });
    }

    await supabaseAdmin.from("meetings").update({ status: "extracting" }).eq("id", meetingId);

    const extractionPromise = anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: `You are assisting a UK wealth management adviser. You already know the following
about this client from previous meetings:

${knownFactsText}

Extract information from today's meeting transcript as raw JSON matching this exact shape,
nothing else, no markdown fences:

{
  "fields": [
    {
      "key": "short_unique_slug",
      "category": "income | expenditure | assets | liabilities | pensions | dependants | objectives | attitude_to_risk | capacity_for_loss | existing_products",
      "label": "Human-readable label, e.g. 'Annual gross income'",
      "value": "Human-readable value, e.g. '£110,000' — never raw numbers or field codes",
      "evidence": "A short paraphrase of what the client actually said that supports this",
      "confidence": "high | medium | low",
      "change_note": "Only include this key if this contradicts or updates something already known — e.g. 'Previously £95,000' — omit entirely if this is new or unchanged information"
    }
  ],
  "attention_items": [
    {
      "title": "Short name of the missing/incomplete item — only include things NOT already covered by what you already know above",
      "status": "Not established | Missing | Incomplete | Not sufficiently established",
      "description": "One sentence on what's missing and why the adviser should follow up"
    }
  ],
  "action_items": [
    { "description": "...", "owner": "adviser | client" }
  ],
  "client_sentiment": {
    "overall_satisfaction": "positive | neutral | unhappy",
    "dissatisfaction_signals": ["..."],
    "suggested_actions": ["..."]
  }
}

Only extract fields genuinely discussed in today's transcript — do not re-list things already known
above unless the client restated or changed them. All monetary figures are in GBP unless stated
otherwise. Do not invent information.`,
      messages: [{ role: "user", content: transcriptText }],
    });

    const summaryPromise = anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: "Write a short, neutral, plain-English summary of this meeting for the client's own records. Topics discussed and agreed next steps only. All monetary figures are in GBP unless stated otherwise.",
      messages: [{ role: "user", content: transcriptText }],
    });

    let facts, summary;
    try {
      const [extraction, summaryResp] = await Promise.all([extractionPromise, summaryPromise]);
      const rawText = extraction.content.find((b) => b.type === "text")!.text;
      facts = JSON.parse(stripFences(rawText));
      summary = summaryResp.content.find((b) => b.type === "text")!.text;
    } catch (e: any) {
      await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
      return Response.json({ step: "anthropic extraction or summary", error: e.message }, { status: 500 });
    }

    const { error: factsInsertErr } = await supabaseAdmin.from("extracted_facts").insert({
      meeting_id: meetingId, category: "facts", payload: facts,
    });
    if (factsInsertErr) {
      await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
      return Response.json({ step: "insert extracted_facts", error: factsInsertErr.message }, { status: 500 });
    }

    if (facts.client_sentiment) {
      await supabaseAdmin.from("internal_notes").insert({
        meeting_id: meetingId, type: "sentiment", payload: facts.client_sentiment,
      });
    }

    const { error: updateErr } = await supabaseAdmin.from("meetings").update({
      status: "done", client_summary: summary,
    }).eq("id", meetingId);
    if (updateErr) {
      return Response.json({ step: "update meeting", error: updateErr.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ step: "unexpected", error: e.message ?? String(e) }, { status: 500 });
  }
}
