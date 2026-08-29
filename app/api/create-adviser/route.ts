import { supabaseAdmin } from "@/lib/supabase/admin";

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export async function POST(req: Request) {
  const { email, fullName } = await req.json();
  if (!email) return Response.json({ error: "email required" }, { status: 400 });

  const password = generatePassword();

  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !authUser.user) {
    return Response.json({ error: authErr?.message ?? "failed to create user" }, { status: 500 });
  }

  const { error: advErr } = await supabaseAdmin
    .from("advisers")
    .upsert({ id: authUser.user.id, email, full_name: fullName || email }, { onConflict: "id" });
  if (advErr) {
    return Response.json({ error: advErr.message }, { status: 500 });
  }

  return Response.json({ email, password });
}
