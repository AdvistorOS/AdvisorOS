import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { data: isAdmin } = await supabaseAdmin
    .from("super_admins").select("email").eq("email", user.email).maybeSingle();
  if (!isAdmin) return Response.json({ error: "not authorized" }, { status: 403 });

  const { firmId } = await req.json();
  if (!firmId) return Response.json({ error: "firmId required" }, { status: 400 });

  const { data: advisers } = await supabaseAdmin.from("advisers").select("id").eq("firm_id", firmId);

  // Revoke each adviser's login access rather than deleting them —
  // their historical client data stays intact and attributable.
  for (const a of advisers ?? []) {
    await supabaseAdmin.auth.admin.updateUserById(a.id, { ban_duration: "876000h" });
    await supabaseAdmin.from("advisers").update({ firm_id: null }).eq("id", a.id);
  }

  const { error } = await supabaseAdmin.from("firms").delete().eq("id", firmId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
