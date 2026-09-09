import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { validSignature, webhookUrl } from "../lib/processing/webhook";

const id = "11111111-1111-4111-8111-111111111111";
const otherToken = "22222222-2222-4222-8222-222222222222";

test("processing lease, stale attempts and transactional preservation", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table meetings(id uuid primary key, status text, client_summary text);
      create table transcripts(id bigserial primary key, meeting_id uuid, full_text text not null, utterances jsonb);
      create table extracted_facts(meeting_id uuid, category text, payload jsonb);
      create table internal_notes(meeting_id uuid, type text, payload jsonb);
      insert into meetings values('${id}', 'transcribing', null);
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/202609080001_processing.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/202609090001_result_loading.sql", import.meta.url), "utf8"));
    const claim = async (retry = false) => (await db.query<{token: string | null}>("select begin_meeting_processing($1, 'extracting', $2) as token", [id, retry])).rows[0].token;
    const token = await claim(); assert.ok(token);
    assert.equal(await claim(), null, "duplicate submission must not create another attempt");
    assert.equal(await claim(true), null, "retry must not replace a live attempt");
    await db.query("select save_meeting_transcript($1,$2,'Original transcript','[]')", [id, token]);
    await assert.rejects(db.query("select save_meeting_transcript($1,$2,null,'[]')", [id, token]));
    assert.equal((await db.query<{full_text:string}>("select full_text from transcripts")).rows[0].full_text, "Original transcript", "failed save must roll back the delete");
    const stale = await db.query<{saved:boolean}>("select save_meeting_transcript($1,$2,'Unwanted','[]') as saved", [id, otherToken]);
    assert.equal(stale.rows[0].saved, false);
    await db.query("update meetings set status='summarizing', processing_started_at=now()-interval '7 minutes' where id=$1", [id]);
    const replacement = await claim(true); assert.ok(replacement); assert.notEqual(replacement, token);
    const oldSave = await db.query<{saved:boolean}>("select save_meeting_analysis($1,$2,'{}','Obsolete summary') as saved", [id, token]);
    assert.equal(oldSave.rows[0].saved, false, "an expired worker must not overwrite a newer attempt");
    await db.query("update meetings set status='summarizing' where id=$1", [id]);
    await db.query("insert into internal_notes values($1,'manual','{\"note\":\"Keep me\"}')", [id]);
    await db.query("select save_meeting_analysis($1,$2,'{\"client_sentiment\":{\"overall_satisfaction\":\"neutral\"}}','Complete summary')", [id, replacement]);
    assert.equal((await db.query<{status:string}>("select status from meetings")).rows[0].status, "done");
    assert.equal((await db.query("select * from internal_notes where type='manual'")).rows.length, 1, "analysis must preserve manual notes");
    assert.equal((await db.query<{enrichment_status:string}>("select enrichment_status from meetings")).rows[0].enrichment_status, "pending", "core results must expose pending enrichment");
    assert.equal(await claim(true), null, "completed meetings must not be reprocessed by intake");
    const permissions = await db.query<{allowed:boolean}>("select has_function_privilege('authenticated', 'begin_meeting_processing(uuid,text,boolean)', 'execute') as allowed");
    assert.equal(permissions.rows[0].allowed, false, "browser sessions must not call service-only functions");
  } finally { await db.close(); }
});

test("callback signature is attempt-specific and contains no provider credential", () => {
  process.env.ASSEMBLYAI_WEBHOOK_SECRET = "test-only-secret-with-at-least-32-characters";
  process.env.ASSEMBLYAI_API_KEY = "provider-key-must-not-appear";
  process.env.NEXT_PUBLIC_APP_URL = "https://advisor.example";
  const url = new URL(webhookUrl(id, otherToken));
  const signature = url.searchParams.get("signature")!;
  assert.equal(validSignature(id, otherToken, signature), true);
  assert.equal(validSignature(id, id, signature), false);
  assert.equal(validSignature(otherToken, otherToken, signature), false);
  assert.equal(validSignature(id, otherToken, "invalid"), false);
  assert.equal(url.toString().includes(process.env.ASSEMBLYAI_API_KEY), false);
  delete process.env.ASSEMBLYAI_WEBHOOK_SECRET;
  assert.equal(validSignature(id, otherToken, signature), false);
});


test("malformed model output cannot be saved as a completed analysis", async () => {
  const { validateExtraction } = await import("../lib/processing/validate");
  assert.throws(() => validateExtraction({ fields: [], attention_items: [], action_items: [], life_events: [], scorecard: {} }));
  assert.throws(() => validateExtraction(null));
  assert.throws(() => validateExtraction({ fields: [{ label: "Pension", value: { amount: 10 } }] }));
  const valid = {
    fields: [], attention_items: [], action_items: [], life_events: [], stage_timeline: [], speaker_sentiment_timeline: {},
    scorecard: Object.fromEntries(["discovery", "question_quality", "listening", "objection_handling", "commercial_positioning", "client_engagement", "next_step_clarity", "talk_ratio", "rapport", "overall"].map(key => [key, { score: 6, reason: "Specific transcript evidence" }])),
    client_sentiment: { overall_satisfaction: "neutral", dissatisfaction_signals: [], suggested_actions: [] },
    objective_assessment: { achieved: null, summary: "No objective set.", what_helped: "", what_hindered: "" },
  };
  assert.doesNotThrow(() => validateExtraction(valid));
  assert.doesNotThrow(() => validateExtraction({ ...valid, stage_timeline: undefined, speaker_sentiment_timeline: undefined }));
  assert.throws(() => validateExtraction({ ...valid, stage_timeline: [{ time: 12 }] }));
});
