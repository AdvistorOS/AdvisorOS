import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const REGION = process.env.AZURE_SPEECH_REGION!;
const KEY = process.env.AZURE_SPEECH_KEY!;
const BASE = `https://${REGION}.api.cognitive.microsoft.com/speaker/identification/v2.0/text-independent`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  const formData = await req.formData();
  const clientId = formData.get("clientId") as string;
  const audioFile = formData.get("audio") as File;
  if (!clientId || !audioFile) return Response.json({ error: "clientId and audio required" }, { status: 400 });

  const { data: client } = await supabaseAdmin.from("clients").select("id, adviser_id").eq("id", clientId).single();
  if (!client || client.adviser_id !== user.id) return Response.json({ error: "not found" }, { status: 404 });

  const { data: contacts } = await supabaseAdmin.from("contacts").select("id, full_name").eq("client_id", clientId);
  const { data: profiles } = await supabaseAdmin
    .from("voice_profiles").select("contact_id, azure_profile_id")
    .in("contact_id", (contacts ?? []).map((c) => c.id)).eq("enrolled", true);

  if (!profiles?.length) {
    return Response.json({ match: null, reason: "no enrolled voices for this client" });
  }

  const audioBytes = await audioFile.arrayBuffer();
  const profileIds = profiles.map((p) => p.azure_profile_id);

  const identifyRes = await fetch(`${BASE}/profiles/identifySingleSpeaker?profileIds=${profileIds.join(",")}`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Type": "audio/wav" },
    body: audioBytes,
  });

  if (!identifyRes.ok) {
    return Response.json({ error: await identifyRes.text() }, { status: 500 });
  }

  const result = await identifyRes.json();
  const topGuess = result.identifiedProfile;

  // Azure returns a confidence level (Low/Medium/High) — only trust Medium+ to avoid bad auto-fills
  if (!topGuess || !topGuess.profileId || topGuess.confidence === "Low") {
    return Response.json({ match: null, reason: "no confident match" });
  }

  const matchedProfile = profiles.find((p) => p.azure_profile_id === topGuess.profileId);
  const matchedContact = contacts?.find((c) => c.id === matchedProfile?.contact_id);

  return Response.json({
    match: matchedContact ? { contactId: matchedContact.id, name: matchedContact.full_name, confidence: topGuess.confidence } : null,
  });
}
