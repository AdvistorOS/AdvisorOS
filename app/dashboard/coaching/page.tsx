"use client";
import { useState } from "react";
import { GraduationCap, Loader2, RefreshCw } from "lucide-react";

export default function CoachingPage() {
  const [patterns, setPatterns] = useState("");
  const [message, setMessage] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/coaching-patterns", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    if (data.patterns) { setPatterns(data.patterns); setCount(data.meetingCount); }
    else setMessage(data.message ?? "Not enough data yet.");
  }

  return (
    <main className="max-w-2xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink mb-1">Coaching</h1>
        <p className="text-ink-muted text-sm">Patterns across your recent meetings — what's working, what isn't.</p>
      </div>

      <button onClick={generate} disabled={loading}
        className="flex items-center justify-center gap-2 bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
        {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        {loading ? "Analysing your meetings…" : patterns ? "Refresh analysis" : "Analyse my meetings"}
      </button>

      {error && <p className="text-sm text-warn">{error}</p>}
      {message && (
        <div className="border border-dashed border-border rounded-xl py-12 text-center">
          <GraduationCap size={22} className="text-ink-muted mx-auto mb-3" />
          <p className="text-sm text-ink-muted">{message}</p>
        </div>
      )}

      {patterns && (
        <section className="bg-surface border border-border rounded-xl p-7 card-shadow">
          {count && <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-4">Based on your last {count} meetings</p>}
          <p className="text-ink leading-relaxed whitespace-pre-wrap text-[15px]">{patterns}</p>
        </section>
      )}
    </main>
  );
}
