"use client";
import { useState } from "react";
import { ClipboardList, Loader2, RefreshCw } from "lucide-react";

export function PrepBrief({ clientId }: { clientId: string }) {
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/prep-brief", {
      method: "POST",
      body: JSON.stringify({ clientId }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setBrief(data.brief);
    else setError(data.error ?? "Something went wrong");
  }

  return (
    <section className="bg-brass-soft/30 border border-brass/25 rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={15} className="text-brass" />
          <p className="font-mono text-xs text-brass uppercase tracking-widest">Prep for next meeting</p>
        </div>
        <button onClick={generate} disabled={loading}
          className="flex items-center gap-1.5 bg-brass text-paper text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? "Building…" : brief ? "Regenerate" : "Generate"}
        </button>
      </div>
      {error && <p className="text-xs text-warn">{error}</p>}
      {brief && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{brief}</p>
        </div>
      )}
      {!brief && !loading && !error && (
        <p className="text-xs text-ink-muted">Pulls together where things stand, open items, and what to focus on next.</p>
      )}
    </section>
  );
}
