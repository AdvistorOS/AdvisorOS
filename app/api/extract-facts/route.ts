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
  const { meetingId } = await req.json();
  if (!meetingId) return Response.json({ error: "meetingId required" }, { status: 400 });

  const { data: meeting } = await supabaseAdmin
    .from("meetings").select("status, client_id, advisers(firm_id)").eq("id", meetingId).single();

  if (!meeting || meeting.status !== "extracting") {
    return Response.json({ ok: true, skipped: true });
  }
  await supabaseAdmin.from("meetings").update({ status: "summarizing" }).eq("id", meetingId);

  const { data: transcriptRows } = await supabaseAdmin
    .from("transcripts").select("full_text").eq("meeting_id", meetingId).order("id", { ascending: false }).limit(1);
  const transcriptText = transcriptRows?.[0]?.full_text ?? "";

  if (!transcriptText || transcriptText.trim().length < 10) {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ step: "load transcript", error: "No transcript text found for this meeting." }, { status: 500 });
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
    .from("client_facts").select("category, data")
    .eq("client_id", meeting.client_id).is("superseded_by", null);
  const knownFactsText = (existingFacts ?? [])
    .map((f: any) => `${f.data.label}: ${f.data.value}`).join("\n")
    || "No prior information on file — this is the first recorded meeting.";

  const extractionPromise = anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: `You are assisting ${domainContext}. You already know the following about this
client from previous meetings:

${knownFactsText}

Extract information from today's meeting transcript as raw JSON matching this exact shape,
nothing else, no markdown fences:

{
  "fields": [
    { "key": "short_unique_slug", "category": "${categorySet}", "label": "Human-readable label", "value": "Human-readable value", "evidence": "A real, specific paraphrase of what was actually said — one clear sentence", "confidence": "high | medium | low", "change_note": "Only if this updates something already known" }
  ],
  "attention_items": [
    { "title": "...", "status": "Not established | Missing | Incomplete | Not sufficiently established", "description": "One sentence on what's missing and why it matters" }
  ],
  "life_events": [
    { "title": "...", "description": "One sentence on what was said and why it matters" }
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

Cover the whole conversation thoroughly — for a long, detailed meeting this can genuinely mean
15-20 fields if that much real information was discussed. Don't pad or invent to hit a number,
but don't artificially limit real detail either. All monetary figures are in GBP unless stated
otherwise. Do not invent information. Output ONLY the raw JSON object, complete and valid,
nothing else — this is critical, an incomplete response is a failure.`,
    messages: [{ role: "user", content: transcriptText }],
  });

  const summaryPromise = anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: "Write a clear, plain-English summary of this meeting for the client's own records — covering the whole conversation with real substance, not padded with filler phrases or throat-clearing. Aim for dense, information-rich prose: what was discussed, what was decided, agreed next steps. Roughly 150-250 words. All monetary figures are in GBP unless stated otherwise.",
    messages: [{ role: "user", content: transcriptText }],
  });

  const [extractionResult, summaryResult] = await Promise.allSettled([extractionPromise, summaryPromise]);

  if (extractionResult.status === "rejected") {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ step: "anthropic extraction", error: String(extractionResult.reason) }, { status: 500 });
  }
  if (summaryResult.status === "rejected") {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ step: "anthropic summary", error: String(summaryResult.reason) }, { status: 500 });
  }

  if (extractionResult.value.stop_reason === "max_tokens") {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ step: "extraction truncated", error: "Response was cut off before completing. Try again." }, { status: 500 });
  }

  let facts, summary;
  try {
    const rawText = extractionResult.value.content.find((b) => b.type === "text")!.text;
    facts = JSON.parse(stripFences(rawText));
    summary = summaryResult.value.content.find((b) => b.type === "text")!.text;
  } catch (e: any) {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ step: "parse anthropic response", error: e.message ?? String(e) }, { status: 500 });
  }

  try {
    await supabaseAdmin.from("extracted_facts").delete().eq("meeting_id", meetingId);
    await supabaseAdmin.from("extracted_facts").insert({ meeting_id: meetingId, category: "facts", payload: facts });
    if (facts.client_sentiment) {
      await supabaseAdmin.from("internal_notes").delete().eq("meeting_id", meetingId);
      await supabaseAdmin.from("internal_notes").insert({ meeting_id: meetingId, type: "sentiment", payload: facts.client_sentiment });
    }
    await supabaseAdmin.from("meetings").update({ status: "done", client_summary: summary }).eq("id", meetingId);
  } catch (e: any) {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ step: "save results", error: e.message ?? String(e) }, { status: 500 });
  }

  return Response.json({ ok: true });
}
