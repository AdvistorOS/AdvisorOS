import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ownedMeeting } from "@/lib/processing/access";
import { begin, check, fail } from "@/lib/processing/state";
import { webhookUrl } from "@/lib/processing/webhook";
import { runAnalysis } from "@/lib/processing/extract";
import { missingRecordingSettings } from "@/lib/processing/config";

export const maxDuration = 300;
class ProcessingStartError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const access = await ownedMeeting(body?.meetingId);
  if (access.error) return access.error;
  const meeting = access.meeting;
  let token: string | null = null;
  let stage = "load_transcript";
  try {
    const { data: transcript, error } = await supabaseAdmin.from("transcripts").select("full_text")
      .eq("meeting_id", meeting.id).order("id", { ascending: false }).limit(1).maybeSingle();
    check(error);
    const hasTranscript = (transcript?.full_text?.trim().length ?? 0) >= 10;
    if (!hasTranscript && !meeting.media_url) return Response.json({ error: "No recording or transcript found. Please upload one." }, { status: 400 });
    if (!hasTranscript) {
      stage = "configuration";
      const missing = missingRecordingSettings();
      if (missing.length) throw new ProcessingStartError("PROCESSING_CONFIGURATION", `Recording processing needs Vercel configuration: ${missing.join(", ")}. Save these settings and redeploy, then retry this meeting.`);
    }
    stage = "claim_attempt";
    token = await begin(meeting.id, hasTranscript ? "extracting" : "transcribing", body?.retry === true);
    if (!token) return Response.json({ error: "This meeting is already processing or complete. Refresh to see its progress." }, { status: 409 });
    if (hasTranscript) {
      const attempt = token;
      after(() => runAnalysis(meeting.id, attempt));
    } else {
      stage = "submit_transcription";
      const callback = webhookUrl(meeting.id, token);
      const res = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST", signal: AbortSignal.timeout(20_000),
        headers: { authorization: process.env.ASSEMBLYAI_API_KEY!, "content-type": "application/json" },
        body: JSON.stringify({ audio_url: meeting.media_url, speaker_labels: true, webhook_url: callback }),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) throw new ProcessingStartError("TRANSCRIPTION_AUTH", "The transcription service rejected its API key. Update ASSEMBLYAI_API_KEY in Vercel and redeploy, then retry.");
        throw new ProcessingStartError(`TRANSCRIPTION_HTTP_${res.status}`, `The transcription service could not accept the recording (HTTP ${res.status}). Check the provider account and recording URL, then retry.`);
      }
      const submitted = await res.json();
      if (typeof submitted.id !== "string") throw new Error("Missing transcript ID");
      stage = "save_transcription_job";
      const { error: saveError } = await supabaseAdmin.from("meetings").update({ transcript_job_id: submitted.id })
        .eq("id", meeting.id).eq("processing_token", token);
      check(saveError);
    }
    return Response.json({ ok: true, status: hasTranscript ? "extracting" : "transcribing" }, { status: 202 });
  } catch (error) {
    const code = error instanceof ProcessingStartError ? error.code : "PROCESSING_START_FAILED";
    const message = error instanceof ProcessingStartError ? error.message : "Unable to start processing. Your recording is saved. Please retry.";
    // Never log provider payloads, callback URLs, API keys, or transcript content.
    console.error("meeting_processing_start", { stage, code });
    if (token) {
      try { await fail(meeting.id, token, message); }
      catch { console.error("meeting_processing_start", { stage: "save_failure", code: "STATUS_SAVE_FAILED" }); }
    }
    return Response.json({ error: message, code }, { status: 503 });
  }
}
