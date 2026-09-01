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

  const { data: advisers, error } = await supabaseAdmin
    .from("advisers").select("id, full_name, email").eq("firm_id", firmId).order("full_name");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ advisers: advisers ?? [] });
}
