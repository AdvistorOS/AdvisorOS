import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;

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
  const url = new URL(req.url);
  const meetingId = url.searchParams.get("meetingId");
  const secret = url.searchParams.get("secret");

  if (!meetingId || secret !== process.env.ASSEMBLYAI_API_KEY) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { transcript_id, status } = body;

  if (status === "error") {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ ok: true });
  }
  if (status !== "completed") {
    return Response.json({ ok: true });
  }

  const { data: currentMeeting } = await supabaseAdmin
    .from("meetings").select("status, client_id, adviser_id, advisers(firm_id)").eq("id", meetingId).single();

  // Allow retry if we're stuck on 'extracting' too, in case a previous attempt crashed
  if (!currentMeeting || (currentMeeting.status !== "transcribing" && currentMeeting.status !== "extracting")) {
    return Response.json({ ok: true, skipped: true });
  }
  await supabaseAdmin.from("meetings").update({ status: "extracting" }).eq("id", meetingId);

  let transcriptText = "";

  try {
    const transcriptRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcript_id}`, {
      headers: { authorization: process.env.ASSEMBLYAI_API_KEY! },
    });
    if (!transcriptRes.ok) {
      await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
      return Response.json({ step: "fetch transcript", error: await transcriptRes.text() }, { status: 500 });
    }
    const transcriptData = await transcriptRes.json();
    transcriptText = transcriptData.text ?? "";

    if (transcriptText.trim().length < 10) {
      await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
      return Response.json({ step: "empty transcript", error: "No speech detected." }, { status: 500 });
    }

    const { data: existingTranscript } = await supabaseAdmin
      .from("transcripts").select("id").eq("meeting_id", meetingId).maybeSingle();
    if (!existingTranscript) {
      await supabaseAdmin.from("transcripts").insert({
        meeting_id: meetingId, full_text: transcriptText, utterances: transcriptData.utterances,
      });
    }
  } catch (e: any) {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ step: "transcript fetch/save", error: e.message ?? String(e) }, { status: 500 });
  }

  let practiceType = "wealth_management";
  const firmId = (currentMeeting as any).advisers?.firm_id;
  if (firmId) {
    const { data: firm } = await supabaseAdmin.from("firms").select("practice_type").eq("id", firmId).single();
    practiceType = firm?.practice_type ?? "wealth_management";
  }
  const categorySet = CATEGORY_SETS[practiceType] ?? CATEGORY_SETS.wealth_management;
  const domainContext = DOMAIN_CONTEXT[practiceType] ?? DOMAIN_CONTEXT.wealth_management;

  const { data: existingFacts } = await supabaseAdmin
    .from("client_facts").select("category, data")
    .eq("client_id", currentMeeting.client_id).is("superseded_by", null);
  const knownFactsText = (existingFacts ?? [])
    .map((f: any) => `${f.data.label}: ${f.data.value}`).join("\n")
    || "No prior information on file — this is the first recorded meeting.";

  let facts;
  try {
    const extraction = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
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
    { "title": "Short name of the missing/incomplete item — only include things NOT already covered above", "status": "Not established | Missing | Incomplete | Not sufficiently established", "description": "One sentence on what's missing and why it matters" }
  ],
  "life_events": [
    { "title": "Short name of a significant event mentioned that affects planning", "description": "One sentence on what was said and why it matters" }
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

For long transcripts, cover the whole conversation, not just the beginning. Limit to the 10
most important fields if the conversation covers a very large number of topics. Only include
fields and attention_items genuinely supported by the transcript. All monetary figures are
in GBP unless stated otherwise. Do not invent information.`,
      messages: [{ role: "user", content: transcriptText }],
    });
    const rawText = extraction.content.find((b) => b.type === "text")!.text;
    facts = JSON.parse(stripFences(rawText));
  } catch (e: any) {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ step: "anthropic extraction", error: e.message ?? String(e) }, { status: 500 });
  }

  let summary;
  try {
    const summaryResp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: "Write a short, neutral, plain-English summary of this meeting for the client's own records, covering the whole conversation. Topics discussed and agreed next steps only. All monetary figures are in GBP unless stated otherwise.",
      messages: [{ role: "user", content: transcriptText }],
    });
    summary = summaryResp.content.find((b) => b.type === "text")!.text;
  } catch (e: any) {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ step: "anthropic summary", error: e.message ?? String(e) }, { status: 500 });
  }

  try {
    await supabaseAdmin.from("extracted_facts").insert({ meeting_id: meetingId, category: "facts", payload: facts });
    if (facts.client_sentiment) {
      await supabaseAdmin.from("internal_notes").insert({ meeting_id: meetingId, type: "sentiment", payload: facts.client_sentiment });
    }
    await supabaseAdmin.from("meetings").update({ status: "done", client_summary: summary }).eq("id", meetingId);
  } catch (e: any) {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ step: "save results", error: e.message ?? String(e) }, { status: 500 });
  }

  return Response.json({ ok: true });
}
