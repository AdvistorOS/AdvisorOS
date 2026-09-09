import { ownedMeeting } from "@/lib/processing/access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const access = await ownedMeeting(body?.meetingId);
  if (access.error) return access.error;
  const meetingId = access.meeting.id;

  // Delete child rows first (no cascade set up on these tables)
  await supabaseAdmin.from("transcripts").delete().eq("meeting_id", meetingId);
  await supabaseAdmin.from("extracted_facts").delete().eq("meeting_id", meetingId);
  await supabaseAdmin.from("internal_notes").delete().eq("meeting_id", meetingId);

  const { error } = await supabaseAdmin.from("meetings").delete().eq("id", meetingId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
