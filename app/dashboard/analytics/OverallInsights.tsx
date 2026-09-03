"use client";
import { useState } from "react";
import { Lightbulb, Loader2, RefreshCw, Target, TrendingDown, Users, Zap } from "lucide-react";

function parseSection(text: string, header: string): string[] {
  const regex = new RegExp(`${header}\\s*\\n((?:- .+\\n?)+)`, "i");
  const match = text.match(regex);
  if (!match) return [];
  return match[1].split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean);
}

export function OverallInsights() {
  const [raw, setRaw] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/overall-insights", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    if (data.insights) setRaw(data.insights);
    else setMessage(data.message ?? "Not enough data yet.");
  }

  const opportunity = parseSection(raw, "BIGGEST OPPORTUNITY");
  const weakest = parseSection(raw, "WEAKEST AREA");
  const clientAttention = parseSection(raw, "CLIENT ATTENTION");
  const quickWins = parseSection(raw, "QUICK WINS");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb size={15} className="text-brass" />
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">AI insights</p>
        </div>
        <button onClick={generate} disabled={loading}
          className="flex items-center gap-1.5 bg-brass text-paper text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? "Analysing…" : raw ? "Refresh" : "Get insights"}
        </button>
      </div>

      {error && <p className="text-sm text-warn">{error}</p>}
      {message && <p className="text-sm text-ink-muted">{message}</p>}

      {opportunity.length > 0 && (
        <div className="bg-ink text-paper rounded-xl p-5 flex items-start gap-3">
          <Target size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-xs uppercase tracking-widest opacity-70 mb-1">Biggest opportunity</p>
            <p className="text-sm">{opportunity[0]}</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {weakest.length > 0 && (
          <div className="bg-warn-soft border border-warn/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={14} className="text-warn" />
              <p className="font-mono text-xs text-warn uppercase tracking-widest">Weakest area</p>
            </div>
            <p className="text-sm text-ink">{weakest[0]}</p>
          </div>
        )}

        {quickWins.length > 0 && (
          <div className="bg-good-soft border border-good/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-good" />
              <p className="font-mono text-xs text-good uppercase tracking-widest">Quick wins</p>
            </div>
            <ul className="space-y-1">
              {quickWins.map((w, i) => <li key={i} className="text-sm text-ink">• {w}</li>)}
            </ul>
          </div>
        )}
      </div>

      {clientAttention.length > 0 && (
        <div className="bg-teal-soft border border-teal/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-teal" />
            <p className="font-mono text-xs text-teal uppercase tracking-widest">Clients needing attention</p>
          </div>
          <ul className="space-y-1">
            {clientAttention.map((c, i) => <li key={i} className="text-sm text-ink">• {c}</li>)}
          </ul>
        </div>
      )}

      {raw && !opportunity.length && !weakest.length && !quickWins.length && !clientAttention.length && (
        <div className="bg-surface border border-border rounded-xl p-5 card-shadow">
          <p className="text-sm text-ink whitespace-pre-wrap">{raw}</p>
        </div>
      )}
    </section>
  );
}
