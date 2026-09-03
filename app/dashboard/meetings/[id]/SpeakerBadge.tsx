import Link from "next/link";
import { User } from "lucide-react";

export function SpeakerBadge({ speakerLabel, attendee, clientId }: {
  speakerLabel: string;
  attendee?: { contactId: string; name: string };
  clientId: string;
}) {
  if (!attendee) {
    return <span className="text-xs font-medium text-ink-muted">Speaker {speakerLabel}</span>;
  }
  return (
    <Link href={`/dashboard/clients/${clientId}/contacts/${attendee.contactId}`}
      className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline">
      <User size={10} /> {attendee.name}
    </Link>
  );
}
