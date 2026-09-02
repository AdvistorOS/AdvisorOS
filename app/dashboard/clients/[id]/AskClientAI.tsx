"use client";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

export function AskClientAI({ clientId }: { clientId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setAnswer("");
    const res = await fetch("/api/ask-client", {
      method: "POST",
      body: JSON.stringify({ clientId, question }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setAnswer(data.answer);
    else setError(data.error ?? "Something went wrong");
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-6 card-shadow">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={15} className="text-teal" />
        <p className="font-mono text-xs text-teal uppercase tracking-widest">Ask about this client</p>
      </div>
      <form onSubmit={handleAsk} className="flex gap-2 mb-3">
        <input value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What's their biggest objection? What have we promised them?"
          className="border border-border rounded-md px-3.5 py-2.5 flex-1 bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
        <button type="submit" disabled={loading || !question.trim()}
          className="bg-teal text-paper text-sm px-4 rounded-md hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5">
          {loading && <Loader2 size={14} className="animate-spin" />}
          Ask
        </button>
      </form>
      {error && <p className="text-xs text-warn">{error}</p>}
      {answer && (
        <div className="bg-paper border border-border rounded-lg p-4">
          <p className="text-sm text-ink whitespace-pre-wrap">{answer}</p>
        </div>
      )}
    </section>
  );
}
