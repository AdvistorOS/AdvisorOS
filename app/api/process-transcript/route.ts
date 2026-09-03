import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { meetingId, transcriptText } = await req.json();
  if (!meetingId || !transcriptText) return Response.json({ error: "meetingId and transcriptText required" }, { status: 400 });

  try {
    await supabaseAdmin.from("transcripts").delete().eq("meeting_id", meetingId);
    await supabaseAdmin.from("transcripts").insert({ meeting_id: meetingId, full_text: transcriptText, utterances: [] });
    await supabaseAdmin.from("meetings").update({ status: "extracting" }).eq("id", meetingId);
    return Response.json({ ok: true });
  } catch (e: any) {
    await supabaseAdmin.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
