import { ownedMeeting } from "@/lib/processing/access";
import { buildIntelligence } from "@/lib/processing/build-intelligence";
export const maxDuration = 120;
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const access = await ownedMeeting(body?.meetingId);
  if (access.error) return access.error;
  return buildIntelligence(access.meeting.id);
}
