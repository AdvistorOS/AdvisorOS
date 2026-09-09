import { ownedMeeting } from "@/lib/processing/access";
import { flagLanguage } from "@/lib/processing/flag-language";
export const maxDuration = 120;
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const access = await ownedMeeting(body?.meetingId);
  if (access.error) return access.error;
  return flagLanguage(access.meeting.id);
}
