"use client";
import { useState } from "react";
import { Sparkles, Loader2, RefreshCw, TrendingUp, ArrowRight, AlertCircle, Users, Target } from "lucide-react";

function section(text: string, header: string): string[] {
  const m = text.match(new RegExp(`${header}\\s*\\n((?:- .+\\n?)+)`, "i"));
  if (!m) return [];
  return m[1].split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean);
}

export function RelationshipInsights({ clientId }: { clientId: string }) {
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/relationship-insights", {
      method: "POST",
      body: JSON.stringify({ clientId }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.insights) setRaw(data.insights);
    else setMsg(data.message ?? data.error ?? "Nothing returned");
  }

  const trajectory = section(raw, "TRAJECTORY");
  const shifted = section(raw, "WHAT'S SHIFTED");
  const blocking = section(raw, "STILL BLOCKING");
  const who = section(raw, "WHO MATTERS");
  const next = section(raw, "DO NEXT");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-teal" />
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Relationship insights</p>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-1.5 bg-teal text-paper text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? "Analysing…" : raw ? "Refresh" : "Analyse"}
        </button>
      </div>

      {msg && <p className="text-sm text-ink-muted">{msg}</p>}

      {trajectory.length > 0 && (
        <div className="bg-ink text-paper rounded-xl p-5 flex items-start gap-3">
          <TrendingUp size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-xs uppercase tracking-widest opacity-70 mb-1">Trajectory</p>
            <p className="text-sm">{trajectory[0]}</p>
          </div>
        </div>
      )}

      {next.length > 0 && (
        <div className="bg-good-soft border border-good/20 rounded-xl p-5 flex items-start gap-3">
          <Target size={16} className="text-good flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-xs text-good uppercase tracking-widest mb-1">Do next</p>
            <p className="text-sm text-ink">{next[0]}</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {shifted.length > 0 && (
          <div className="bg-brass-soft/40 border border-brass/25 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRight size={14} className="text-brass" />
              <p className="font-mono text-xs text-brass uppercase tracking-widest">What's shifted</p>
            </div>
            <ul className="space-y-1.5">
              {shifted.map((s, i) => <li key={i} className="text-sm text-ink">• {s}</li>)}
            </ul>
          </div>
        )}

        {blocking.length > 0 && (
          <div className="bg-warn-soft border border-warn/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} className="text-warn" />
              <p className="font-mono text-xs text-warn uppercase tracking-widest">Still blocking</p>
            </div>
            <ul className="space-y-1.5">
              {blocking.map((s, i) => <li key={i} className="text-sm text-ink">• {s}</li>)}
            </ul>
          </div>
        )}
      </div>

      {who.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 card-shadow">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-teal" />
            <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Who matters</p>
          </div>
          <ul className="space-y-1.5">
            {who.map((s, i) => <li key={i} className="text-sm text-ink">• {s}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
