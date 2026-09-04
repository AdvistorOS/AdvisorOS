"use client";
import { useState } from "react";
import Link from "next/link";
import { Radar, Loader2, RefreshCw, Clock, RotateCcw, TrendingUp, Lightbulb, AlertTriangle, Snowflake } from "lucide-react";

const TYPE_META: Record<string, { icon: any; label: string; cls: string }> = {
  overdue_commitment: { icon: Clock, label: "Overdue commitment", cls: "bg-warn-soft border-warn/25" },
  repeated_unresolved: { icon: RotateCcw, label: "Repeated unresolved", cls: "bg-brass-soft/50 border-brass/25" },
  relationship_change: { icon: TrendingUp, label: "Relationship change", cls: "bg-teal-soft border-teal/25" },
  emerging_opportunity: { icon: Lightbulb, label: "Emerging opportunity", cls: "bg-good-soft border-good/25" },
  contradiction: { icon: AlertTriangle, label: "Contradiction", cls: "bg-warn-soft border-warn/40" },
  going_cold: { icon: Snowflake, label: "Going cold", cls: "bg-surface border-border" },
};

export function AttentionAlerts() {
  const [alerts, setAlerts] = useState<any[] | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/attention-alerts", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (data.alerts) {
      setAlerts(data.alerts);
      if (!data.alerts.length) setMsg(data.message ?? "Nothing needs attention right now.");
    } else setMsg(data.error ?? "Nothing returned");
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar size={15} className="text-teal" />
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Needs attention</p>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-1.5 bg-teal text-paper text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? "Scanning…" : alerts ? "Refresh" : "Scan all clients"}
        </button>
      </div>

      {msg && <p className="text-sm text-ink-muted">{msg}</p>}
      {!alerts && !loading && !msg && (
        <p className="text-xs text-ink-muted">Scans every client for overdue commitments, stalled issues, position changes and contradictions.</p>
      )}

      <div className="space-y-2">
        {(alerts ?? []).map((a: any, i: number) => {
          const meta = TYPE_META[a.type] ?? TYPE_META.going_cold;
          const Icon = meta.icon;
          return (
            <Link key={i} href={`/dashboard/clients/${a.client_id}`}
              className={`block border rounded-lg px-4 py-3 hover:opacity-90 transition ${meta.cls}`}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Icon size={12} className="text-ink-muted flex-shrink-0" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">{meta.label}</span>
                <span className="text-xs text-ink-muted">· {a.client_name}</span>
                {a.urgency === "high" && (
                  <span className="font-mono text-[10px] text-warn ml-auto">urgent</span>
                )}
              </div>
              <p className="text-sm text-ink font-medium">{a.headline}</p>
              <p className="text-xs text-ink-muted mt-0.5">{a.detail}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
