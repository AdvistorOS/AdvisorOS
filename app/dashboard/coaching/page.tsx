"use client";
import { useState } from "react";
import { GraduationCap, Loader2, RefreshCw, TrendingUp, TrendingDown, Sparkles, Target } from "lucide-react";

function parseSection(text: string, header: string): string[] {
  const regex = new RegExp(`${header}\\s*\\n((?:- .+\\n?)+)`, "i");
  const match = text.match(regex);
  if (!match) return [];
  return match[1].split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean);
}

export default function CoachingPage() {
  const [raw, setRaw] = useState("");
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
    if (data.patterns) { setRaw(data.patterns); setCount(data.meetingCount); }
    else setMessage(data.message ?? "Not enough data yet.");
  }

  const strengths = parseSection(raw, "STRENGTHS");
  const weaknesses = parseSection(raw, "WEAKNESSES");
  const whatWorks = parseSection(raw, "WHAT WORKS");
  const focusNext = parseSection(raw, "FOCUS NEXT");

  return (
    <main className="max-w-2xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink mb-1">Coaching</h1>
        <p className="text-ink-muted text-sm">Patterns across your recent meetings — what's working, what isn't.</p>
      </div>

      <button onClick={generate} disabled={loading}
        className="flex items-center justify-center gap-2 bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
        {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        {loading ? "Analysing your meetings…" : raw ? "Refresh analysis" : "Analyse my meetings"}
      </button>

      {error && <p className="text-sm text-warn">{error}</p>}
      {message && (
        <div className="border border-dashed border-border rounded-xl py-12 text-center">
          <GraduationCap size={22} className="text-ink-muted mx-auto mb-3" />
          <p className="text-sm text-ink-muted">{message}</p>
        </div>
      )}

      {raw && (
        <>
          {count && <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Based on your last {count} meetings</p>}

          {focusNext.length > 0 && (
            <div className="bg-ink text-paper rounded-xl p-5 flex items-start gap-3">
              <Target size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-mono text-xs uppercase tracking-widest opacity-70 mb-1">Focus next</p>
                <p className="text-sm">{focusNext[0]}</p>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {strengths.length > 0 && (
              <div className="bg-good-soft border border-good/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} className="text-good" />
                  <p className="font-mono text-xs text-good uppercase tracking-widest">Strengths</p>
                </div>
                <ul className="space-y-1.5">
                  {strengths.map((s, i) => <li key={i} className="text-sm text-ink">• {s}</li>)}
                </ul>
              </div>
            )}

            {weaknesses.length > 0 && (
              <div className="bg-warn-soft border border-warn/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown size={14} className="text-warn" />
                  <p className="font-mono text-xs text-warn uppercase tracking-widest">Weaknesses</p>
                </div>
                <ul className="space-y-1.5">
                  {weaknesses.map((w, i) => <li key={i} className="text-sm text-ink">• {w}</li>)}
                </ul>
              </div>
            )}
          </div>

          {whatWorks.length > 0 && (
            <div className="bg-teal-soft border border-teal/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-teal" />
                <p className="font-mono text-xs text-teal uppercase tracking-widest">What works</p>
              </div>
              <p className="text-sm text-ink">{whatWorks[0]}</p>
            </div>
          )}

          {!strengths.length && !weaknesses.length && !whatWorks.length && !focusNext.length && (
            <div className="bg-surface border border-border rounded-xl p-6 card-shadow">
              <p className="text-sm text-ink whitespace-pre-wrap">{raw}</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}
