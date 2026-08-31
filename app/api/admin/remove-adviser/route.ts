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

  // Revoke login access — ban for a very long duration rather than deleting the account,
  // so their historical clients/meetings stay intact and attributable.
  const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(adviserId, {
    ban_duration: "876000h",
  });
  if (banErr) return Response.json({ error: banErr.message }, { status: 500 });

  const { error: firmErr } = await supabaseAdmin
    .from("advisers").update({ firm_id: null }).eq("id", adviserId);
  if (firmErr) return Response.json({ error: firmErr.message }, { status: 500 });

  return Response.json({ ok: true });
}
