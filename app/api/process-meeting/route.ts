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
      system: `You are assisting a UK wealth management adviser. Extract information from this
client meeting transcript as raw JSON matching this exact shape, nothing else, no markdown fences:

{
  "fields": [
    {
      "key": "short_unique_slug",
      "category": "income | expenditure | assets | liabilities | pensions | dependants | objectives | attitude_to_risk | capacity_for_loss | existing_products",
      "label": "Human-readable label, e.g. 'Annual gross income'",
      "value": "Human-readable value, e.g. '£110,000' — never raw numbers or field codes",
      "evidence": "A short paraphrase of what the client actually said that supports this",
      "confidence": "high | medium | low — low if the figure was approximate, unclear, or inferred rather than stated plainly"
    }
  ],
  "attention_items": [
    {
      "title": "Short name of the missing/incomplete item, e.g. 'Retirement income target'",
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

Only include fields and attention_items genuinely supported by the transcript. All monetary
figures are in GBP unless stated otherwise. Do not invent information.`,
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
