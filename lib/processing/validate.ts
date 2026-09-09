const dimensions = ["discovery", "question_quality", "listening", "objection_handling", "commercial_positioning", "client_engagement", "next_step_clarity", "talk_ratio", "rapport", "overall"];
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function strings(value: unknown, keys: string[]) { return object(value) && keys.every(key => typeof value[key] === "string"); }
function list(value: unknown, max: number, valid: (item: unknown) => boolean) { return Array.isArray(value) && value.length <= max && value.every(valid); }

/** Reject incomplete or malformed model output before it can reach the UI or database. */
export function validateExtraction(value: unknown): asserts value is Record<string, unknown> {
  if (!object(value)
    || !list(value.fields, 6, item => strings(item, ["key", "category", "label", "value", "evidence", "confidence"]))
    || !list(value.attention_items, 5, item => strings(item, ["title", "status", "description"]))
    || !list(value.life_events, 3, item => strings(item, ["title", "description"]))
    || !list(value.action_items, 4, item => strings(item, ["description", "owner"]))
    || !object(value.scorecard)
    || !dimensions.every(key => {
      const score = (value.scorecard as Record<string, unknown>)[key];
      return object(score) && typeof score.score === "number" && score.score >= 0 && score.score <= 10 && typeof score.reason === "string";
    })
    || (value.stage_timeline !== undefined && !list(value.stage_timeline, 5, item => strings(item, ["time", "stage", "note"])))
    || (value.speaker_sentiment_timeline !== undefined && (!object(value.speaker_sentiment_timeline)
      || !Object.values(value.speaker_sentiment_timeline).every(items => list(items, 3, item => strings(item, ["time", "sentiment", "note"])))))
    || !object(value.client_sentiment)
    || !["positive", "neutral", "unhappy"].includes(String(value.client_sentiment.overall_satisfaction))
    || !list(value.client_sentiment.dissatisfaction_signals, 20, item => typeof item === "string")
    || !list(value.client_sentiment.suggested_actions, 20, item => typeof item === "string")
    || !object(value.objective_assessment)
    || !strings(value.objective_assessment, ["summary", "what_helped", "what_hindered"])) {
    throw new Error("Incomplete or malformed meeting analysis");
  }
}
