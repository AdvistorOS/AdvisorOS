"use client";
import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

export function BriefCard({ clientId }: { clientId: string }) {
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/generate-brief", { method: "POST", body: JSON.stringify({ clientId }) })
      .then((r) => r.json())
      .then((d) => { setBrief(d.text); setLoading(false); });
  }, [clientId]);

  return (
    <section className="bg-teal-soft border border-teal/20 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={15} className="text-teal" />
        <p className="font-mono text-xs text-teal uppercase tracking-widest">Pre-meeting brief</p>
      </div>
      {loading ? (
        <p className="text-sm text-ink-muted">Preparing…</p>
      ) : (
        <p className="text-sm text-ink leading-relaxed">{brief}</p>
      )}
    </section>
  );
}
