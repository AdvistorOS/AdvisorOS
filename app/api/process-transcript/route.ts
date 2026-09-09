import { after } from "next/server";
import { ownedMeeting } from "@/lib/processing/access";
import { begin, fail, saveTranscript } from "@/lib/processing/state";
import { runAnalysis } from "@/lib/processing/extract";

export const maxDuration = 300;
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const access = await ownedMeeting(body?.meetingId);
  if (access.error) return access.error;
  const text = body?.transcriptText;
  if (typeof text !== "string" || text.trim().length < 10 || text.length > 400_000) {
    return Response.json({ error: "Use a transcript between 10 and 400,000 characters." }, { status: 400 });
  }
  const id = access.meeting.id;
  let token: string | null = null;
  try {
    token = await begin(id, "extracting");
    if (!token) return Response.json({ error: "This meeting is already processing or complete." }, { status: 409 });
    if (!await saveTranscript(id, token, text.trim())) throw new Error("Processing attempt replaced");
    const attempt = token;
    after(() => runAnalysis(id, attempt));
    return Response.json({ ok: true, status: "extracting" }, { status: 202 });
  } catch {
    if (token) await fail(id, token);
    return Response.json({ error: "Unable to start analysis. Please retry." }, { status: 503 });
  }
}
