import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const VALID = ["accepted", "edited", "rejected", "disputed", "needs_verification", "confirmed", "ai_inferred"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { objectId, validationStatus, newValue } = await req.json();
  if (!objectId || !VALID.includes(validationStatus)) {
    return Response.json({ error: "objectId and valid validationStatus required" }, { status: 400 });
  }

  const { data: obj } = await supabaseAdmin
    .from("intelligence_objects").select("id, client_id").eq("id", objectId).single();
  if (!obj) return Response.json({ error: "not found" }, { status: 404 });

  const { data: client } = await supabaseAdmin
    .from("clients").select("adviser_id").eq("id", obj.client_id).single();
  if (client?.adviser_id !== user.id) return Response.json({ error: "not authorized" }, { status: 403 });

  const update: any = { validation_status: validationStatus };
  if (newValue) update.value = newValue;

  const { error } = await supabaseAdmin.from("intelligence_objects").update(update).eq("id", objectId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
