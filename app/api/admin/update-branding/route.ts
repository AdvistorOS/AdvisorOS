import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { data: isAdmin } = await supabaseAdmin
    .from("super_admins").select("email").eq("email", user.email).maybeSingle();
  if (!isAdmin) return Response.json({ error: "not authorized" }, { status: 403 });

  const { firmId, brandColor, brandAccent, brandLogoUrl } = await req.json();
  if (!firmId) return Response.json({ error: "firmId required" }, { status: 400 });

  const { data: updated, error } = await supabaseAdmin.from("firms").update({
    brand_color: brandColor || null,
    brand_accent: brandAccent || null,
    brand_logo_url: brandLogoUrl || null,
  }).eq("id", firmId).select();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    ok: true,
    receivedFirmId: firmId,
    rowsUpdated: updated?.length ?? 0,
    updatedRow: updated,
  });
}
