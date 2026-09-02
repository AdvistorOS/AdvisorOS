import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;

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
    .from("meetings").select("status").eq("id", meetingId).single();
  if (!currentMeeting || currentMeeting.status !== "transcribing") {
    return Response.json({ ok: true, skipped: true });
  }

  try {
    const transcriptRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcript_id}`, {
      headers: { authorization: process.env.ASSEMBLYAI_API_KEY! },
    });
    if (!transcriptRes.ok) {
      await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
      return Response.json({ step: "fetch transcript", error: await transcriptRes.text() }, { status: 500 });
    }
    const transcriptData = await transcriptRes.json();
    const transcriptText = transcriptData.text ?? "";

    if (transcriptText.trim().length < 10) {
      await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
      return Response.json({ step: "empty transcript", error: "No speech detected." }, { status: 500 });
    }

    // Always clear any existing transcript row for this meeting first — retries
    // must never leave more than one row behind, or .single() lookups downstream break.
    await supabaseAdmin.from("transcripts").delete().eq("meeting_id", meetingId);
    await supabaseAdmin.from("transcripts").insert({
      meeting_id: meetingId, full_text: transcriptText, utterances: transcriptData.utterances,
    });
    await supabaseAdmin.from("meetings").update({ status: "extracting" }).eq("id", meetingId);

    return Response.json({ ok: true });
  } catch (e: any) {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ step: "transcript fetch/save", error: e.message ?? String(e) }, { status: 500 });
  }
}
