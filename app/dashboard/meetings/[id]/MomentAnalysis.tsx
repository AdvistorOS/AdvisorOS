"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Swords, Loader2, RefreshCw } from "lucide-react";
import { jumpToTimestamp } from "./MeetingAudioPlayer";

const STYLES: Record<string, { label: string; cls: string }> = {
  brilliant: { label: "Brilliant", cls: "bg-good-soft border-good/30 text-good" },
  good: { label: "Good", cls: "bg-teal-soft border-teal/30 text-teal" },
  missed: { label: "Missed", cls: "bg-brass-soft border-brass/30 text-brass" },
  mistake: { label: "Mistake", cls: "bg-warn-soft border-warn/30 text-warn" },
  blunder: { label: "Blunder", cls: "bg-warn-soft border-warn/50 text-warn" },
};

export function MomentAnalysis({ meetingId }: { meetingId: string }) {
  const supabase = createClient();
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("meeting_moments").select("payload").eq("meeting_id", meetingId)
      .maybeSingle().then(({ data }) => { if (data?.payload) setPayload(data.payload); });
  }, [meetingId]);

  async function analyze() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/analyze-moments", {
      method: "POST",
      body: JSON.stringify({ meetingId }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setPayload(data.payload);
    else setError(data.error ?? "Something went wrong");
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-6 card-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Swords size={15} className="text-teal" />
          <p className="font-mono text-xs text-teal uppercase tracking-widest">Key moments</p>
        </div>
        <button onClick={analyze} disabled={loading}
          className="flex items-center gap-1.5 bg-teal text-paper text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? "Analysing…" : payload ? "Re-analyse" : "Analyse"}
        </button>
      </div>

      {error && <p className="text-xs text-warn mb-2">{error}</p>}

      {!payload && !loading && !error && (
        <p className="text-xs text-ink-muted">Reviews the meeting for pivotal moments — what worked, what was missed, and what to do differently.</p>
      )}

      {payload?.headline && (
        <div className="bg-ink text-paper rounded-lg px-4 py-3 mb-3">
          <p className="text-sm">{payload.headline}</p>
        </div>
      )}

      <div className="space-y-2.5">
        {(payload?.moments ?? []).map((m: any, i: number) => {
          const s = STYLES[m.classification] ?? STYLES.good;
          return (
            <div key={i} className={`border rounded-lg p-4 ${s.cls.replace(/text-\S+/, "")}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${s.cls}`}>
                  {s.label}
                </span>
                <button onClick={() => jumpToTimestamp(m.time)}
                  className="font-mono text-xs text-teal underline hover:opacity-70 transition">
                  ▶ {m.time}
                </button>
              </div>
              <p className="text-sm text-ink font-medium mb-1">{m.what_happened}</p>
              {m.excerpt && <p className="text-xs text-ink-muted italic mb-1.5">"{m.excerpt}"</p>}
              <p className="text-xs text-ink-muted">{m.why_it_mattered}</p>
              {m.better_approach && (
                <p className="text-xs text-ink mt-2 pt-2 border-t border-border/60">
                  <span className="font-medium">Better: </span>{m.better_approach}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
