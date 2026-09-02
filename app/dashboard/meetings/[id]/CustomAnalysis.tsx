"use client";
import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";

export function CustomAnalysis({ meetingId }: { meetingId: string }) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setResult("");
    const res = await fetch("/api/analyze-meeting", {
      method: "POST",
      body: JSON.stringify({ meetingId, prompt }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else setError(data.error ?? "Something went wrong");
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-6 card-shadow">
      <div className="flex items-center gap-2 mb-3">
        <Wand2 size={15} className="text-teal" />
        <p className="font-mono text-xs text-teal uppercase tracking-widest">Custom analysis</p>
      </div>
      <form onSubmit={handleAnalyze} className="flex gap-2 mb-3">
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Analyse everything the client said about competitors"
          className="border border-border rounded-md px-3.5 py-2.5 flex-1 bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
        <button type="submit" disabled={loading || !prompt.trim()}
          className="bg-teal text-paper text-sm px-4 rounded-md hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5">
          {loading && <Loader2 size={14} className="animate-spin" />}
          Analyze
        </button>
      </form>
      {error && <p className="text-xs text-warn">{error}</p>}
      {result && (
        <div className="bg-paper border border-border rounded-lg p-4">
          <p className="text-sm text-ink whitespace-pre-wrap">{result}</p>
        </div>
      )}
    </section>
  );
}
