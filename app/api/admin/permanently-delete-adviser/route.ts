import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { data: isAdmin } = await supabaseAdmin
    .from("super_admins").select("email").eq("email", user.email).maybeSingle();
  if (!isAdmin) return Response.json({ error: "not authorized" }, { status: 403 });

  const { adviserId } = await req.json();
  if (!adviserId) return Response.json({ error: "adviserId required" }, { status: 400 });

  // Delete everything belonging to this adviser's clients, then the clients,
  // then the adviser row, then their login. Order matters — children first.
  const { data: clients } = await supabaseAdmin.from("clients").select("id").eq("adviser_id", adviserId);
  const clientIds = (clients ?? []).map((c) => c.id);

  const { data: meetings } = await supabaseAdmin.from("meetings").select("id").eq("adviser_id", adviserId);
  const meetingIds = (meetings ?? []).map((m) => m.id);

  if (meetingIds.length > 0) {
    await supabaseAdmin.from("internal_notes").delete().in("meeting_id", meetingIds);
    await supabaseAdmin.from("extracted_facts").delete().in("meeting_id", meetingIds);
    await supabaseAdmin.from("transcripts").delete().in("meeting_id", meetingIds);
  }
  if (clientIds.length > 0) {
    await supabaseAdmin.from("actions").delete().in("client_id", clientIds);
    await supabaseAdmin.from("client_facts").delete().in("client_id", clientIds);
    await supabaseAdmin.from("client_notes").delete().in("client_id", clientIds);
  }
  await supabaseAdmin.from("meetings").delete().eq("adviser_id", adviserId);
  await supabaseAdmin.from("clients").delete().eq("adviser_id", adviserId);
  await supabaseAdmin.from("advisers").delete().eq("id", adviserId);

  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(adviserId);
  if (authErr) return Response.json({ error: authErr.message }, { status: 500 });

  return Response.json({ ok: true });
}
