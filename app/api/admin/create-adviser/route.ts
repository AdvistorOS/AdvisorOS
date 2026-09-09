import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { data: isAdmin } = await supabaseAdmin
    .from("super_admins").select("email").eq("email", user.email).maybeSingle();
  if (!isAdmin) return Response.json({ error: "not authorized" }, { status: 403 });

  const { email, fullName, firmId } = await req.json();
  if (!email) return Response.json({ error: "email required" }, { status: 400 });

  const emailKey = process.env.RESEND_API_KEY;
  if (!emailKey) {
    return Response.json({ error: "Invitation email is not configured. Add RESEND_API_KEY in Vercel before creating an adviser." }, { status: 503 });
  }
  const resend = new Resend(emailKey);

  const password = generatePassword();

  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (authErr || !authUser.user) {
    return Response.json({ error: authErr?.message ?? "failed to create user" }, { status: 500 });
  }

  const { error: advErr } = await supabaseAdmin
    .from("advisers")
    .upsert({ id: authUser.user.id, email, full_name: fullName || email, firm_id: firmId || null }, { onConflict: "id" });
  if (advErr) return Response.json({ error: advErr.message }, { status: 500 });

  let emailSent = true;
  let emailError = "";
  try {
    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Your AdvisorOS login",
      text: "Login: https://advisor-os-fawn.vercel.app\nEmail: " + email + "\nPassword: " + password,
    });
    if (error) {
      emailSent = false;
      emailError = error.message;
    }
  } catch (e: unknown) {
    emailSent = false;
    emailError = e instanceof Error ? e.message : "Invitation email could not be sent.";
  }

  return Response.json({ email, password, emailSent, emailError });
}
