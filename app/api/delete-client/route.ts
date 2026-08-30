import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { clientId } = await req.json();

  const { data: meetings } = await supabaseAdmin.from("meetings").select("id").eq("client_id", clientId);
  const meetingIds = (meetings ?? []).map((m) => m.id);

  if (meetingIds.length > 0) {
    await supabaseAdmin.from("internal_notes").delete().in("meeting_id", meetingIds);
    await supabaseAdmin.from("extracted_facts").delete().in("meeting_id", meetingIds);
    await supabaseAdmin.from("transcripts").delete().in("meeting_id", meetingIds);
  }
  await supabaseAdmin.from("actions").delete().eq("client_id", clientId);
  await supabaseAdmin.from("client_facts").delete().eq("client_id", clientId);
  await supabaseAdmin.from("meetings").delete().eq("client_id", clientId);

  const { error } = await supabaseAdmin.from("clients").delete().eq("id", clientId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
