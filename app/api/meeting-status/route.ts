import { createClient } from "@/lib/supabase/server";
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("meetingId");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Invalid meeting ID" }, { status: 400 });
  const { data, error } = await supabase.from("meetings")
    .select("status, enrichment_status, processing_error, processing_started_at")
    .eq("id", id).eq("adviser_id", user.id).maybeSingle();
  if (error) return Response.json({ error: "Progress temporarily unavailable" }, { status: 503 });
  if (!data) return Response.json({ error: "Meeting not found" }, { status: 404 });
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
