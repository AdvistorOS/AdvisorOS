import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return Response.json({ error: "add ?email=you@example.com to the URL" }, { status: 400 });
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ link: data.properties?.action_link });
}
