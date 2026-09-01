import { AssemblyAI } from "assemblyai";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";

const aai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function stripFences(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

const CATEGORY_SETS: Record<string, string> = {
  wealth_management: "income | expenditure | assets | liabilities | pensions | dependants | objectives | attitude_to_risk | capacity_for_loss | existing_products",
  profit_consulting: "revenue | costs | margins | cash_flow | operations | team_structure | growth_objectives | competitive_position | risks_challenges",
};

const DOMAIN_CONTEXT: Record<string, string> = {
  wealth_management: "a UK wealth management adviser having a client meeting about their personal finances, goals, and risk profile",
  profit_consulting: "a business/profit consultant having a meeting with a client company about their revenue, costs, margins, and operational performance",
};

export async function POST(req: Request) {
  const { meetingId } = await req.json();

  try {
    const { data: meeting, error: meetingFetchErr } = await supabaseAdmin
      .from("meetings").select("*, clients(*), advisers(firm_id)").eq("id", meetingId).single();
    if (meetingFetchErr || !meeting) {
      return Response.json({ step: "fetch meeting", error: meetingFetchErr?.message ?? "not found" }, { status: 500 });
    }

    let practiceType = "wealth_management";
    const firmId = (meeting as any).advisers?.firm_id;
    if (firmId) {
      const { data: firm } = await supabaseAdmin.from("firms").select("practice_type").eq("id", firmId).single();
      practiceType = firm?.practice_type ?? "wealth_management";
    }
    const categorySet = CATEGORY_SETS[practiceType] ?? CATEGORY_SETS.wealth_management;
    const domainContext = DOMAIN_CONTEXT[practiceType] ?? DOMAIN_CONTEXT.wealth_management;

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
      system: `You are assisting ${domainContext}. You already know the following about this
client from previous meetings:

${knownFactsText}

Extract information from today's meeting transcript as raw JSON matching this exact shape,
nothing else, no markdown fences:

{
  "fields": [
    {
      "key": "short_unique_slug",
      "category": "${categorySet}",
      "label": "Human-readable label appropriate to the category",
      "value": "Human-readable value — never raw numbers or field codes",
      "evidence": "A short paraphrase of what was actually said that supports this",
      "confidence": "high | medium | low",
      "change_note": "Only include this key if this contradicts or updates something already known — omit entirely if new or unchanged"
    }
  ],
  "attention_items": [
    {
      "title": "Short name of the missing/incomplete item — only include things NOT already covered above",
      "status": "Not established | Missing | Incomplete | Not sufficiently established",
      "description": "One sentence on what's missing and why it matters"
    }
  ],
  "life_events": [
    {
      "title": "Short name of a significant event mentioned that affects planning",
      "description": "One sentence on what was said and why it matters"
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
