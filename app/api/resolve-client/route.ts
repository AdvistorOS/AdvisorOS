import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { findBestMatch, normalise, domainFromEmail } from "@/lib/identity";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const { name, email } = await req.json();
  if (!name) return Response.json({ error: "name required" }, { status: 400 });

  const { data: candidates } = await supabaseAdmin
    .from("clients").select("id, full_name, normalised_name, domain, aliases").eq("adviser_id", user.id);

  const result = findBestMatch(name, email ?? null, candidates ?? []);
  if (!result) return Response.json({ match: null });

  const [{ count: meetingCount }, { data: contacts }, { data: lastMeeting }] = await Promise.all([
    supabaseAdmin.from("meetings").select("*", { count: "exact", head: true }).eq("client_id", result.match.id),
    supabaseAdmin.from("contacts").select("id, full_name").eq("client_id", result.match.id),
    supabaseAdmin.from("meetings").select("created_at").eq("client_id", result.match.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return Response.json({
    match: {
      id: result.match.id,
      name: result.match.full_name,
      reason: result.reason,
      strength: result.strength,
      meetingCount: meetingCount ?? 0,
      contactCount: contacts?.length ?? 0,
      contactNames: (contacts ?? []).map((c) => c.full_name),
      lastInteraction: lastMeeting?.created_at ?? null,
    },
  });
}
