import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ownedMeeting } from "@/lib/processing/access";
import { begin, check, fail } from "@/lib/processing/state";
import { webhookUrl } from "@/lib/processing/webhook";
import { runAnalysis } from "@/lib/processing/extract";

export const maxDuration = 300;
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const access = await ownedMeeting(body?.meetingId);
  if (access.error) return access.error;
  const meeting = access.meeting;
  let token: string | null = null;
  try {
    const { data: transcript, error } = await supabaseAdmin.from("transcripts").select("full_text")
      .eq("meeting_id", meeting.id).order("id", { ascending: false }).limit(1).maybeSingle();
    check(error);
    const hasTranscript = (transcript?.full_text?.trim().length ?? 0) >= 10;
    if (!hasTranscript && !meeting.media_url) return Response.json({ error: "No recording or transcript found. Please upload one." }, { status: 400 });
    token = await begin(meeting.id, hasTranscript ? "extracting" : "transcribing", body?.retry === true);
    if (!token) return Response.json({ error: "This meeting is already processing or complete. Refresh to see its progress." }, { status: 409 });
    if (hasTranscript) {
      const attempt = token;
      after(() => runAnalysis(meeting.id, attempt));
    } else {
      const callback = webhookUrl(meeting.id, token);
      const res = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST", signal: AbortSignal.timeout(20_000),
        headers: { authorization: process.env.ASSEMBLYAI_API_KEY!, "content-type": "application/json" },
        body: JSON.stringify({ audio_url: meeting.media_url, speaker_labels: true, webhook_url: callback }),
      });
      if (!res.ok) throw new Error("Transcription submission failed");
      const submitted = await res.json();
      if (typeof submitted.id !== "string") throw new Error("Missing transcript ID");
      const { error: saveError } = await supabaseAdmin.from("meetings").update({ transcript_job_id: submitted.id })
        .eq("id", meeting.id).eq("processing_token", token);
      check(saveError);
    }
    return Response.json({ ok: true, status: hasTranscript ? "extracting" : "transcribing" }, { status: 202 });
  } catch {
    if (token) await fail(meeting.id, token, "Processing could not start. Please retry. If this continues, contact your workspace administrator.");
    return Response.json({ error: "Unable to start processing. Please retry." }, { status: 503 });
  }
}
