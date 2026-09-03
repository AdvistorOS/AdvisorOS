"use client";
import { Route } from "lucide-react";
import { jumpToTimestamp } from "./MeetingAudioPlayer";

const STAGE_COLORS: Record<string, string> = {
  Introduction: "bg-ink-muted",
  Discovery: "bg-teal",
  "Problem Recognition": "bg-brass",
  Commercial: "bg-teal",
  Objection: "bg-warn",
  Resolution: "bg-good",
  "Buying Signal": "bg-good",
  "Next Step": "bg-good",
};

export function StageTimeline({ stages }: { stages: { time: string; stage: string; note: string }[] }) {
  if (!stages?.length) return null;

  return (
    <section className="bg-surface border border-border rounded-xl p-6 card-shadow">
      <div className="flex items-center gap-2 mb-4">
        <Route size={15} className="text-teal" />
        <p className="font-mono text-xs text-teal uppercase tracking-widest">Conversation flow</p>
      </div>
      <div className="space-y-0">
        {stages.map((s, i) => (
          <button key={i} onClick={() => jumpToTimestamp(s.time)}
            className="flex items-start gap-3 w-full text-left py-2.5 hover:bg-teal-soft/40 rounded-md px-2 -mx-2 transition group">
            <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
              <span className={`w-2.5 h-2.5 rounded-full ${STAGE_COLORS[s.stage] ?? "bg-ink-muted"}`} />
              {i < stages.length - 1 && <span className="w-px flex-1 bg-border mt-1" style={{ minHeight: "16px" }} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-teal group-hover:underline">▶ {s.time}</span>
                <span className="text-sm text-ink font-medium">{s.stage}</span>
              </div>
              {s.note && <p className="text-xs text-ink-muted mt-0.5">{s.note}</p>}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
