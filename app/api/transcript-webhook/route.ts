import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validSignature } from "@/lib/processing/webhook";
import { check, fail, saveTranscript } from "@/lib/processing/state";
import { runAnalysis } from "@/lib/processing/extract";

export const maxDuration = 300;
export async function POST(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("meetingId") ?? "";
  const token = url.searchParams.get("token") ?? "";
  if (!validSignature(id, token, url.searchParams.get("signature") ?? "")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body.transcript_id !== "string") return Response.json({ error: "Invalid callback" }, { status: 400 });
  try {
    const { data: meeting, error } = await supabaseAdmin.from("meetings").select("status, transcript_job_id")
      .eq("id", id).eq("processing_token", token).maybeSingle();
    check(error);
    if (!meeting || !["transcribing", "extracting"].includes(meeting.status)) return Response.json({ ok: true, skipped: true });
    // Ask the provider to retry if its callback arrived before the submission was saved.
    if (!meeting.transcript_job_id) return Response.json({ error: "Submission pending" }, { status: 503 });
    if (meeting.transcript_job_id !== body.transcript_id) return Response.json({ error: "Unmatched transcript" }, { status: 403 });
    if (body.status === "error") {
      await fail(id, token, "The recording could not be transcribed. Check that it contains audible speech, then retry.");
      return Response.json({ ok: true });
    }
    if (body.status !== "completed") return Response.json({ ok: true });
    if (meeting.status === "transcribing") {
      const res = await fetch(`https://api.assemblyai.com/v2/transcript/${encodeURIComponent(body.transcript_id)}`, {
        signal: AbortSignal.timeout(20_000), headers: { authorization: process.env.ASSEMBLYAI_API_KEY! },
      });
      if (!res.ok) throw new Error("Transcript fetch failed");
      const data = await res.json();
      if (data.status !== "completed" || typeof data.text !== "string" || data.text.trim().length < 10) {
        await fail(id, token, "No usable speech was detected. Please check the recording and retry.");
        return Response.json({ ok: true });
      }
      if (!await saveTranscript(id, token, data.text, data.utterances ?? [])) return Response.json({ ok: true, skipped: true });
    }
    after(() => runAnalysis(id, token));
    return Response.json({ ok: true });
  } catch {
    // Keep the attempt live so a provider retry can recover a transient fetch/database error.
    return Response.json({ error: "Unable to handle callback. Please retry." }, { status: 503 });
  }
}
