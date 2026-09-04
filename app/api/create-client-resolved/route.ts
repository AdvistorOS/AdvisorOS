import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalise, domainFromEmail } from "@/lib/identity";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { name, email } = await req.json();
  if (!name) return Response.json({ error: "name required" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("clients").insert({
    full_name: name.trim(),
    email: email?.trim() || null,
    adviser_id: user.id,
    normalised_name: normalise(name),
    domain: domainFromEmail(email),
  }).select().single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ client: data });
}
