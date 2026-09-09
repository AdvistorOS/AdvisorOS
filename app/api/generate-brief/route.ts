import { ownedClient } from "@/lib/processing/access";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const access = await ownedClient(body?.clientId);
  if (access.error) return access.error;
  const clientId = access.client.id;

  const { data: client } = await supabaseAdmin.from("clients").select("full_name").eq("id", clientId).single();
  const { data: facts } = await supabaseAdmin.from("client_facts").select("data, created_at").eq("client_id", clientId).is("superseded_by", null);
  const { data: actions } = await supabaseAdmin.from("actions").select("description, owner, status").eq("client_id", clientId).eq("status", "open");
  const { data: lastMeeting } = await supabaseAdmin.from("meetings").select("created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).single();

  if (!facts?.length && !actions?.length) {
    return Response.json({ text: `No prior information on file for ${client?.full_name ?? "this client"} yet.` });
  }

  const factsText = (facts ?? []).map((f: any) => `${f.data.label}: ${f.data.value}`).join("\n");
  const actionsText = (actions ?? []).map((a: any) => `${a.description} (${a.owner})`).join("\n") || "None";
  const daysSince = lastMeeting?.created_at
    ? Math.round((Date.now() - new Date(lastMeeting.created_at).getTime()) / 86400000)
    : null;

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: `Write a short, warm, spoken-style pre-meeting brief for a wealth adviser about to see this
client again — the kind of thing they'd read in 30 seconds before walking into the room. Reference
how long since they last met if given. Mention their key goals and any outstanding actions. Do not
invent anything not present in the data. Keep it to 3-5 sentences, conversational, not a bulleted list.`,
    messages: [{
      role: "user",
      content: `Client: ${client?.full_name}\nDays since last meeting: ${daysSince ?? "unknown"}\n\nKnown facts:\n${factsText}\n\nOpen actions:\n${actionsText}`,
    }],
  });
  const text = resp.content.find((b) => b.type === "text")!.text;
  return Response.json({ text });
}
