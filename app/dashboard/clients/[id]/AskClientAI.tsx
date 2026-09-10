"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, ArrowUpRight } from "lucide-react";

type Source = { label: string; meetingId: string; title: string; date: string };
const suggestions = ["What have we promised this client?", "What is blocking the next step?", "What should I cover in our next meeting?"];

export function AskClientAI({ clientId }: { clientId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [scope, setScope] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function ask(value: string) {
    const text = value.trim();
    if (!text || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 55_000);
    setLoading(true); setError(""); setAnswer(""); setSources([]); setScope(""); setQuestion(text);
    try {
      const res = await fetch("/api/ask-client", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, question: text }), signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The answer could not be completed. Please try again.");
      setAnswer(data.answer); setSources(data.sources ?? []); setScope(data.scope ?? "");
    } catch (err) {
      setError(controller.signal.aborted ? "The request took too long. Try a shorter question." : err instanceof Error ? err.message : "Connection lost. Please try again.");
    } finally {
      clearTimeout(timeout); active.current = null; setLoading(false);
    }
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 card-shadow" aria-busy={loading}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={18} className="text-teal" aria-hidden="true" />
        <h2 className="text-base font-semibold text-ink">Ask about this client</h2>
      </div>
      <p className="text-sm text-ink-muted mb-4">Prepare for the next conversation using recent meeting summaries and current client records.</p>
      <form onSubmit={e => { e.preventDefault(); void ask(question); }} className="flex flex-col sm:flex-row gap-2">
        <label className="sr-only" htmlFor={`client-question-${clientId}`}>Question about this client</label>
        <input id={`client-question-${clientId}`} value={question} onChange={e => setQuestion(e.target.value)} maxLength={2000}
          placeholder="Ask about commitments, objections or next steps…" disabled={loading}
          className="border border-border rounded-lg px-3.5 py-3 min-w-0 flex-1 bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
        <button type="submit" disabled={loading || !question.trim()}
          className="bg-teal text-paper text-sm font-medium px-5 py-3 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
          {loading ? "Checking records…" : "Ask"}
        </button>
      </form>
      <div className="flex flex-wrap gap-2 mt-3">
        {suggestions.map(text => <button key={text} type="button" disabled={loading} onClick={() => void ask(text)}
          className="text-xs text-ink-muted border border-border rounded-full px-3 py-2 hover:bg-paper hover:text-ink disabled:opacity-50">{text}</button>)}
      </div>
      {error && <div role="alert" className="mt-4 text-sm text-warn">{error} <button type="button" onClick={() => void ask(question)} className="underline font-medium">Try again</button></div>}
      {loading && <p role="status" className="mt-4 text-sm text-ink-muted">Reading the available history. This may take a moment.</p>}
      {answer && <div className="mt-5 bg-paper border border-border rounded-lg p-4" aria-live="polite">
        <p className="text-sm leading-7 text-ink whitespace-pre-wrap">{answer}</p>
        {sources.length > 0 && <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-ink-muted mb-2">Meetings cited — open to check the evidence</p>
          <div className="flex flex-wrap gap-2">{sources.map(source => <Link key={source.meetingId} href={`/dashboard/meetings/${source.meetingId}`}
            className="inline-flex items-center gap-2 text-xs text-teal border border-border rounded-lg px-3 py-2 bg-surface">
            [{source.label}] {source.title} · {new Date(source.date).toLocaleDateString("en-GB")} <ArrowUpRight size={13} aria-hidden="true" />
          </Link>)}</div>
        </div>}
        <p className="mt-4 text-xs text-ink-muted">{scope} Check the source records before acting.</p>
      </div>}
    </section>
  );
}
