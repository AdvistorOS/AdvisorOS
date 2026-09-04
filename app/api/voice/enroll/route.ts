import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const REGION = process.env.AZURE_SPEECH_REGION!;
const KEY = process.env.AZURE_SPEECH_KEY!;
const BASE = `https://${REGION}.api.cognitive.microsoft.com/speaker/identification/v2.0/text-independent`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 });

  if (!REGION || !KEY) {
    return Response.json({ error: "Azure Speech credentials are not configured on the server." }, { status: 500 });
  }

  const formData = await req.formData();
  const contactId = formData.get("contactId") as string;
  const audioFile = formData.get("audio") as File;
  if (!contactId || !audioFile) {
    return Response.json({ error: "contactId and audio required" }, { status: 400 });
  }

  const { data: contact } = await supabaseAdmin
    .from("contacts").select("id, client_id, clients(adviser_id)").eq("id", contactId).single();
  if (!contact || (contact.clients as any)?.adviser_id !== user.id) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const { data: existing } = await supabaseAdmin
    .from("voice_profiles").select("*").eq("contact_id", contactId).maybeSingle();

  let azureProfileId = existing?.azure_profile_id;

  if (!azureProfileId) {
    const createRes = await fetch(`${BASE}/profiles`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "en-us" }),
    });
    if (!createRes.ok) {
      return Response.json({ step: "create profile", error: await createRes.text() }, { status: 500 });
    }
    const created = await createRes.json();
    azureProfileId = created.profileId;
    await supabaseAdmin.from("voice_profiles").insert({
      contact_id: contactId, azure_profile_id: azureProfileId, enrolled: false,
    });
  }

  const audioBytes = await audioFile.arrayBuffer();
  const enrollRes = await fetch(`${BASE}/profiles/${azureProfileId}/enrollments`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Type": "audio/wav" },
    body: audioBytes,
  });

  if (!enrollRes.ok) {
    return Response.json({ step: "enroll", error: await enrollRes.text() }, { status: 500 });
  }

  const result = await enrollRes.json();
  const enrolled = result.enrollmentStatus === "Enrolled";

  await supabaseAdmin.from("voice_profiles").update({ enrolled }).eq("contact_id", contactId);

  return Response.json({
    ok: true,
    status: result.enrollmentStatus,
    remainingSpeechSeconds: result.remainingEnrollmentsSpeechLength ?? 0,
    audioLength: result.audioLength ?? null,
  });
}
