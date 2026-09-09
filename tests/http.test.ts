import test from "node:test";
import assert from "node:assert/strict";

const base = process.env.TEST_BASE_URL;
if (base && !["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("HTTP tests only run against a local test server.");

test("anonymous requests cannot read, process or delete client data", { skip: !base }, async () => {
  for (const route of ["ask-client", "process-meeting", "process-transcript", "extract-facts", "build-intelligence", "flag-language", "delete-meeting", "delete-client", "generate-brief", "generate-file-note", "generate-followup-email", "analyze-contacts", "extract-docx"]) {
    const res = await fetch(`${base}/api/${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetingId: "11111111-1111-4111-8111-111111111111", clientId: "11111111-1111-4111-8111-111111111111" }) });
    assert.equal(res.status, 401, `${route} must require authentication`);
  }
});

test("retired debug endpoint and forged transcription callbacks disclose nothing", { skip: !base }, async () => {
  const progress = await fetch(`${base}/api/meeting-status?meetingId=11111111-1111-4111-8111-111111111111`);
  assert.equal(progress.status, 401);
  const debug = await fetch(`${base}/api/debug-env`);
  assert.equal(debug.status, 404);
  assert.deepEqual(await debug.json(), { error: "Not found" });
  const webhook = await fetch(`${base}/api/transcript-webhook?meetingId=anything&secret=anything`, { method: "POST", body: "{}" });
  assert.equal(webhook.status, 401);
});
