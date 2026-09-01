import { supabaseAdmin } from "@/lib/supabase/admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://advisor-os-fawn.vercel.app";

export async function POST(req: Request) {
  const { meetingId } = await req.json();

  try {
    const { data: meeting, error: meetingFetchErr } = await supabaseAdmin
      .from("meetings").select("*").eq("id", meetingId).single();
    if (meetingFetchErr || !meeting) {
      return Response.json({ step: "fetch meeting", error: meetingFetchErr?.message ?? "not found" }, { status: 500 });
    }

    const webhookUrl = `${APP_URL}/api/transcript-webhook?meetingId=${meetingId}&secret=${process.env.ASSEMBLYAI_API_KEY}`;

    const submitRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        authorization: process.env.ASSEMBLYAI_API_KEY!,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        audio_url: meeting.media_url,
        speaker_labels: true,
        webhook_url: webhookUrl,
      }),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
      return Response.json({ step: "assemblyai submit", error: errText }, { status: 500 });
    }

    await supabaseAdmin.from("meetings").update({ status: "transcribing" }).eq("id", meetingId);

    return Response.json({ ok: true, status: "submitted" });
  } catch (e: any) {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ step: "unexpected", error: e.message ?? String(e) }, { status: 500 });
  }
}
