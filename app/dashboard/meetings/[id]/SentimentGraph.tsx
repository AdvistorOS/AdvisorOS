"use client";
import { Activity } from "lucide-react";
import { jumpToTimestamp } from "./MeetingAudioPlayer";
import { SpeakerBadge } from "./SpeakerBadge";

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "bg-good", engaged: "bg-good", enthusiastic: "bg-good", reassured: "bg-good",
  neutral: "bg-ink-muted",
  cautious: "bg-brass", skeptical: "bg-brass", hesitant: "bg-brass",
  frustrated: "bg-warn", concerned: "bg-warn", negative: "bg-warn",
};

function colorFor(s: string) {
  const key = Object.keys(SENTIMENT_COLOR).find((k) => s.toLowerCase().includes(k));
  return key ? SENTIMENT_COLOR[key] : "bg-teal";
}

export function SentimentGraph({ speakerSentiment, attendeeNames, attendeeContactIds, clientId }: {
  speakerSentiment: Record<string, { time: string; sentiment: string; note: string }[]>;
  attendeeNames: Record<string, string>;
  attendeeContactIds: Record<string, string>;
  clientId: string;
}) {
  const speakers = Object.keys(speakerSentiment ?? {}).filter((k) => speakerSentiment[k]?.length);
  if (!speakers.length) return null;

  return (
    <section className="bg-surface border border-border rounded-xl p-6 card-shadow">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={15} className="text-teal" />
        <p className="font-mono text-xs text-teal uppercase tracking-widest">Engagement over time</p>
      </div>
      <div className="space-y-5">
        {speakers.map((speakerLabel) => {
          const points = speakerSentiment[speakerLabel];
          const contactId = attendeeContactIds[speakerLabel];
          const name = attendeeNames[speakerLabel];
          return (
            <div key={speakerLabel}>
              <div className="mb-2">
                <SpeakerBadge speakerLabel={speakerLabel} clientId={clientId}
                  attendee={contactId ? { contactId, name } : undefined} />
              </div>
              <div className="flex items-center gap-1">
                {points.map((p, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <button onClick={() => jumpToTimestamp(p.time)}
                      className={`w-full h-8 rounded-md ${colorFor(p.sentiment)} hover:opacity-80 transition flex items-center justify-center`}
                      title={p.note}>
                      <span className="text-[9px] text-paper font-mono px-1 truncate">{p.sentiment}</span>
                    </button>
                    <span className="font-mono text-[9px] text-ink-muted">{p.time}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
