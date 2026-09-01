import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { data: isAdmin } = await supabaseAdmin
    .from("super_admins").select("email").eq("email", user.email).maybeSingle();
  if (!isAdmin) return Response.json({ error: "not authorized" }, { status: 403 });

  const { adviserId, name, email } = await req.json();
  if (!adviserId || !name) return Response.json({ error: "adviserId and name required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("clients")
    .insert({ full_name: name, email: email?.trim() || null, adviser_id: adviserId })
    .select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ client: data });
}
