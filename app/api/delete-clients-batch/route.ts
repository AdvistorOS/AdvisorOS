import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { clientIds } = await req.json();
  if (!Array.isArray(clientIds) || !clientIds.length) {
    return Response.json({ error: "clientIds array required" }, { status: 400 });
  }

  // Confirm every client actually belongs to this adviser before touching anything
  const { data: owned } = await supabaseAdmin.from("clients").select("id").eq("adviser_id", user.id).in("id", clientIds);
  const ownedIds = (owned ?? []).map((c) => c.id);
  if (!ownedIds.length) return Response.json({ error: "no matching clients found" }, { status: 404 });

  const { data: meetings } = await supabaseAdmin.from("meetings").select("id").in("client_id", ownedIds);
  const meetingIds = (meetings ?? []).map((m) => m.id);

  const { data: contacts } = await supabaseAdmin.from("contacts").select("id").in("client_id", ownedIds);
  const contactIds = (contacts ?? []).map((c) => c.id);

  if (meetingIds.length > 0) {
    await supabaseAdmin.from("internal_notes").delete().in("meeting_id", meetingIds);
    await supabaseAdmin.from("extracted_facts").delete().in("meeting_id", meetingIds);
    await supabaseAdmin.from("transcripts").delete().in("meeting_id", meetingIds);
    await supabaseAdmin.from("meeting_attendees").delete().in("meeting_id", meetingIds);
  }
  if (contactIds.length > 0) {
    await supabaseAdmin.from("contact_profiles").delete().in("contact_id", contactIds);
  }
  await supabaseAdmin.from("actions").delete().in("client_id", ownedIds);
  await supabaseAdmin.from("client_facts").delete().in("client_id", ownedIds);
  await supabaseAdmin.from("client_notes").delete().in("client_id", ownedIds);
  await supabaseAdmin.from("contacts").delete().in("client_id", ownedIds);
  await supabaseAdmin.from("meetings").delete().in("client_id", ownedIds);
  await supabaseAdmin.from("clients").delete().in("id", ownedIds);

  return Response.json({ ok: true, deletedCount: ownedIds.length });
}
