import { after } from "next/server";
import { ownedMeeting } from "@/lib/processing/access";
import { begin } from "@/lib/processing/state";
import { runAnalysis } from "@/lib/processing/extract";
export const maxDuration = 300;
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const access = await ownedMeeting(body?.meetingId);
  if (access.error) return access.error;
  try {
    const meeting = access.meeting;
    // Compatibility with pending pre-upgrade meetings. Never restart a live analysis.
    const token = meeting.status === "extracting" && meeting.processing_token
      ? meeting.processing_token : await begin(meeting.id, "extracting", body?.retry === true);
    if (!token) return Response.json({ ok: true, skipped: true });
    after(() => runAnalysis(meeting.id, token));
    return Response.json({ ok: true }, { status: 202 });
  } catch {
    return Response.json({ error: "Unable to start analysis." }, { status: 503 });
  }
}
