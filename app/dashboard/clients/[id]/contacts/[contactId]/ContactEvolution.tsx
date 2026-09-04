"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, ArrowRight, Target, AlertCircle, Handshake, Quote, MessageCircle, HelpCircle } from "lucide-react";

function withLinks(text: string) {
  const parts = text.split(/(\(meeting:[a-f0-9-]+(?: at \d+:\d+)?\))/g);
  return parts.map((p, i) => {
    const m = p.match(/\(meeting:([a-f0-9-]+)(?: at (\d+:\d+))?\)/);
    if (!m) return <span key={i}>{p}</span>;
    return (
      <Link key={i} href={`/dashboard/meetings/${m[1]}`} className="text-teal hover:underline font-mono text-[10px] mx-1">
        ▶ {m[2] ?? "source"}
      </Link>
    );
  });
}

export function ContactEvolution({ contactId }: { contactId: string }) {
  const [d, setD] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/contact-evolution", { method: "POST", body: JSON.stringify({ contactId }) });
    const data = await res.json();
    setLoading(false);
    if (data.evolution) { setD(data.evolution); setMeta(data); }
    else setMsg(data.message ?? data.error ?? "Nothing returned");
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Profile</p>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-1.5 bg-teal text-paper text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? "Building…" : d ? "Refresh" : "Build profile"}
        </button>
      </div>

      {msg && <p className="text-sm text-ink-muted">{msg}</p>}

      {d && (
        <>
          <div className="bg-surface border border-border rounded-xl p-5 card-shadow">
            <div className="flex items-center gap-4 flex-wrap mb-2 text-xs">
              <span className="text-ink-muted">Influence: <span className="text-ink font-medium">{d.influence}</span></span>
              <span className="text-ink-muted">Relationship: <span className="text-ink font-medium">{d.relationship_strength}</span></span>
              <span className="font-mono text-ink-muted ml-auto">{meta?.meetingCount} meetings</span>
            </div>
            <p className="text-sm text-ink leading-relaxed">{d.summary}</p>
            {d.influence_reasoning && <p className="text-xs text-ink-muted mt-2">{d.influence_reasoning}</p>}
            {d.communication_style && (
              <p className="text-xs text-ink-muted mt-2 pt-2 border-t border-border/50 flex items-start gap-1.5">
                <MessageCircle size={11} className="flex-shrink-0 mt-0.5" /> {d.communication_style}
              </p>
            )}
          </div>

          {d.position_evolution?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight size={14} className="text-brass" />
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Position evolution</p>
              </div>
              <div className="space-y-2">
                {d.position_evolution.map((p: any, i: number) => (
                  <div key={i} className="bg-brass-soft/40 border border-brass/25 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-sm text-ink font-medium">{p.topic}</p>
                      <span className="font-mono text-[10px] text-ink-muted ml-auto">{p.confidence} confidence</span>
                    </div>
                    <p className="text-xs text-ink-muted">Initially: {p.initial}</p>
                    <p className="text-xs text-ink mt-1">Now: {p.current}</p>
                    {p.evidence && <p className="text-[10px] mt-1.5">{withLinks(p.evidence)}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {d.priorities?.length > 0 && (
              <div className="bg-surface border border-border rounded-xl p-4 card-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Target size={13} className="text-teal" />
                  <p className="font-mono text-[10px] text-ink-muted uppercase tracking-widest">Priorities</p>
                </div>
                <ul className="space-y-1">{d.priorities.map((x: string, i: number) => <li key={i} className="text-sm text-ink">• {x}</li>)}</ul>
              </div>
            )}
            {d.concerns?.length > 0 && (
              <div className="bg-warn-soft border border-warn/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={13} className="text-warn" />
                  <p className="font-mono text-[10px] text-warn uppercase tracking-widest">Concerns</p>
                </div>
                <ul className="space-y-1">{d.concerns.map((x: string, i: number) => <li key={i} className="text-sm text-ink">• {x}</li>)}</ul>
              </div>
            )}
            {d.engages_strongly_on?.length > 0 && (
              <div className="bg-good-soft border border-good/20 rounded-xl p-4">
                <p className="font-mono text-[10px] text-good uppercase tracking-widest mb-2">Engages strongly on</p>
                <ul className="space-y-1">{d.engages_strongly_on.map((x: string, i: number) => <li key={i} className="text-sm text-ink">• {x}</li>)}</ul>
              </div>
            )}
            {d.resistant_on?.length > 0 && (
              <div className="bg-surface border border-border rounded-xl p-4 card-shadow">
                <p className="font-mono text-[10px] text-ink-muted uppercase tracking-widest mb-2">Resistant on</p>
                <ul className="space-y-1">{d.resistant_on.map((x: string, i: number) => <li key={i} className="text-sm text-ink">• {x}</li>)}</ul>
              </div>
            )}
          </div>

          {d.commitments?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Handshake size={14} className="text-teal" />
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Commitments</p>
              </div>
              <div className="space-y-2">
                {d.commitments.map((c: any, i: number) => (
                  <div key={i} className="bg-surface border border-border rounded-lg px-4 py-2.5 card-shadow flex items-center gap-2">
                    <p className="text-sm text-ink">{c.what}</p>
                    <span className={`font-mono text-[10px] ml-auto ${c.status === "fulfilled" ? "text-good" : c.status === "outstanding" ? "text-warn" : "text-ink-muted"}`}>
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {d.key_quotes?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Quote size={14} className="text-ink-muted" />
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Key quotes</p>
              </div>
              <div className="space-y-2">
                {d.key_quotes.map((q: any, i: number) => (
                  <div key={i} className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
                    <p className="text-sm text-ink italic">"{q.quote}"</p>
                    <p className="text-xs text-ink-muted mt-1">{q.why}</p>
                    {q.evidence && <p className="text-[10px] mt-1">{withLinks(q.evidence)}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {d.open_questions?.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-4 card-shadow">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle size={13} className="text-ink-muted" />
                <p className="font-mono text-[10px] text-ink-muted uppercase tracking-widest">Open questions</p>
              </div>
              <ul className="space-y-1">{d.open_questions.map((x: string, i: number) => <li key={i} className="text-sm text-ink">• {x}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
