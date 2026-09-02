import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { meetingId } = await req.json();
  if (!meetingId) return Response.json({ error: "meetingId required" }, { status: 400 });

  const { data: meeting } = await supabaseAdmin
    .from("meetings").select("id, adviser_id, media_path, media_url").eq("id", meetingId).single();
  if (!meeting || meeting.adviser_id !== user.id) return Response.json({ error: "not found" }, { status: 404 });

  if (!meeting.media_path) {
    // Old meeting recorded before this fix — fall back to the stored URL, which may already be dead.
    return Response.json({ url: meeting.media_url, permanent: false });
  }

  const { data, error } = await supabaseAdmin.storage
    .from("recordings").createSignedUrl(meeting.media_path, 3600);
  if (error || !data) return Response.json({ error: error?.message ?? "could not generate URL" }, { status: 500 });

  return Response.json({ url: data.signedUrl, permanent: true });
}
