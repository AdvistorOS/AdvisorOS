"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { jumpToTimestamp } from "./MeetingAudioPlayer";

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptViewer({ meetingId, attendeeNames }: { meetingId: string; attendeeNames: Record<string, string> }) {
  const supabase = createClient();
  const [utterances, setUtterances] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    supabase.from("transcripts").select("utterances").eq("meeting_id", meetingId)
      .order("id", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setUtterances((data?.utterances as any[]) ?? []));
  }, [meetingId]);

  if (!utterances.length) return null;

  const visible = expanded ? utterances : utterances.slice(0, 6);

  return (
    <section className="bg-surface border border-border rounded-xl p-6 card-shadow">
      <button onClick={() => setExpanded((e) => !e)} className="flex items-center justify-between w-full mb-3">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-teal" />
          <p className="font-mono text-xs text-teal uppercase tracking-widest">Full transcript</p>
        </div>
        {expanded ? <ChevronUp size={15} className="text-ink-muted" /> : <ChevronDown size={15} className="text-ink-muted" />}
      </button>
      <div className="space-y-2.5">
        {visible.map((u: any, i: number) => (
          <div key={i} className="flex gap-3">
            <button onClick={() => jumpToTimestamp(formatTime(u.start))}
              className="font-mono text-xs text-teal hover:underline flex-shrink-0 pt-0.5 w-12 text-left">
              ▶ {formatTime(u.start)}
            </button>
            <div>
              <span className="text-xs font-medium text-ink-muted">{attendeeNames[u.speaker] ?? `Speaker ${u.speaker}`}: </span>
              <span className="text-sm text-ink">{u.text}</span>
            </div>
          </div>
        ))}
      </div>
      {!expanded && utterances.length > 6 && (
        <button onClick={() => setExpanded(true)} className="text-xs text-teal hover:underline mt-3">
          Show all {utterances.length} lines
        </button>
      )}
    </section>
  );
}
