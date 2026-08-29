import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { email } = await req.json();
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ link: data.properties?.action_link });
}
