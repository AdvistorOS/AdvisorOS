"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ClipboardList, Loader2, RefreshCw } from "lucide-react";

function renderWithLinks(text: string) {
  const parts = text.split(/(\(meeting:[a-f0-9-]+(?: at \d+:\d+)?\))/g);
  return parts.map((p, i) => {
    const m = p.match(/\(meeting:([a-f0-9-]+)(?: at (\d+:\d+))?\)/);
    if (!m) return <span key={i}>{p}</span>;
    return (
      <Link key={i} href={`/dashboard/meetings/${m[1]}`}
        className="text-teal hover:underline font-mono text-xs mx-1">
        ▶ {m[2] ?? "source"}
      </Link>
    );
  });
}

export function MeetingPrep({ meetingId }: { meetingId: string }) {
  const supabase = createClient();
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("prep_briefs").select("content").eq("meeting_id", meetingId)
      .maybeSingle().then(({ data }) => { if (data?.content) setBrief(data.content); });
  }, [meetingId]);

  async function run() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/meeting-prep", { method: "POST", body: JSON.stringify({ meetingId }) });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setBrief(data.brief);
    else setError(data.error ?? "Failed");
  }

  return (
    <section className="bg-brass-soft/30 border border-brass/25 rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={15} className="text-brass" />
          <p className="font-mono text-xs text-brass uppercase tracking-widest">Pre-meeting brief</p>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-1.5 bg-brass text-paper text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? "Preparing…" : brief ? "Regenerate" : "Generate brief"}
        </button>
      </div>
      {error && <p className="text-xs text-warn">{error}</p>}
      {!brief && !loading && !error && (
        <p className="text-xs text-ink-muted">Pulls everything known about this client and these attendees into one briefing.</p>
      )}
      {brief && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{renderWithLinks(brief)}</div>
        </div>
      )}
    </section>
  );
}
