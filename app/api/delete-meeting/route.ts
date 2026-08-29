import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { meetingId } = await req.json();

  // Delete child rows first (no cascade set up on these tables)
  await supabaseAdmin.from("transcripts").delete().eq("meeting_id", meetingId);
  await supabaseAdmin.from("extracted_facts").delete().eq("meeting_id", meetingId);
  await supabaseAdmin.from("internal_notes").delete().eq("meeting_id", meetingId);

  const { error } = await supabaseAdmin.from("meetings").delete().eq("id", meetingId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
