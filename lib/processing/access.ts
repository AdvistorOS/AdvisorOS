import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function ownedMeeting(meetingId: unknown) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "Please sign in to continue." }, { status: 401 }) };
  if (typeof meetingId !== "string" || !/^[0-9a-f-]{36}$/i.test(meetingId)) {
    return { error: Response.json({ error: "A valid meeting ID is required." }, { status: 400 }) };
  }
  const { data: meeting, error } = await supabaseAdmin.from("meetings")
    .select("*").eq("id", meetingId).eq("adviser_id", user.id).maybeSingle();
  if (error) return { error: Response.json({ error: "Unable to load this meeting." }, { status: 503 }) };
  if (!meeting) return { error: Response.json({ error: "Meeting not found." }, { status: 404 }) };
  return { meeting };
}

export async function ownedClient(clientId: unknown) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "Please sign in to continue." }, { status: 401 }) };
  if (typeof clientId !== "string" || !/^[0-9a-f-]{36}$/i.test(clientId)) {
    return { error: Response.json({ error: "A valid client ID is required." }, { status: 400 }) };
  }
  const { data: client, error } = await supabaseAdmin.from("clients").select("id")
    .eq("id", clientId).eq("adviser_id", user.id).maybeSingle();
  if (error) return { error: Response.json({ error: "Unable to load this client." }, { status: 503 }) };
  if (!client) return { error: Response.json({ error: "Client not found." }, { status: 404 }) };
  return { client };
}
