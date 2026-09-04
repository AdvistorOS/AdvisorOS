"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, TrendingUp, AlertTriangle, HelpCircle, ArrowRight, Handshake, Users, Flame } from "lucide-react";

const TRAJ: Record<string, string> = {
  advancing: "text-good", steady: "text-ink", stalling: "text-brass", deteriorating: "text-warn",
};

export function ClientOverview({ clientId }: { clientId: string }) {
  const [data, setData] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/client-overview", { method: "POST", body: JSON.stringify({ clientId }) });
    const d = await res.json();
    setLoading(false);
    if (d.overview) { setData(d.overview); setMeta(d); }
    else setMsg(d.message ?? d.error ?? "Nothing returned");
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Account overview</p>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-1.5 bg-teal text-paper text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? "Synthesising…" : data ? "Refresh" : "Build overview"}
        </button>
      </div>

      {msg && <p className="text-sm text-ink-muted">{msg}</p>}
      {!data && !loading && !msg && (
        <p className="text-xs text-ink-muted">Synthesises every meeting into a single current picture of this account.</p>
      )}

      {data && (
        <>
          <div className="bg-surface border border-border rounded-xl p-5 card-shadow">
            <div className="flex items-center gap-4 flex-wrap mb-3">
              <div>
                <p className="text-[10px] font-mono text-ink-muted uppercase tracking-widest">Status</p>
                <p className="text-sm text-ink font-medium">{data.relationship_status}</p>
              </div>
              {data.trajectory && (
                <div>
                  <p className="text-[10px] font-mono text-ink-muted uppercase tracking-widest">Trajectory</p>
                  <p className={`text-sm font-medium capitalize ${TRAJ[data.trajectory.direction] ?? "text-ink"}`}>
                    {data.trajectory.direction}
                  </p>
                </div>
              )}
              <div className="ml-auto text-right">
                <p className="font-mono text-xs text-ink-muted">
                  {meta?.meetingCount} meetings · {meta?.contactCount} contacts
                </p>
                {meta?.lastInteraction && (
                  <p className="font-mono text-[10px] text-ink-muted">
                    Last: {new Date(meta.lastInteraction).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <p className="text-sm text-ink leading-relaxed">{data.current_position}</p>
            {data.trajectory?.reasoning && (
              <p className="text-xs text-ink-muted mt-2 pt-2 border-t border-border/50">{data.trajectory.reasoning}</p>
            )}
          </div>

          {data.what_matters_now?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Flame size={14} className="text-warn" />
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">What matters now</p>
              </div>
              <div className="space-y-2">
                {data.what_matters_now.map((w: any, i: number) => (
                  <div key={i} className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-ink-muted">{i + 1}</span>
                      <p className="text-sm text-ink font-medium">{w.item}</p>
                      {w.meeting_id && (
                        <Link href={`/dashboard/meetings/${w.meeting_id}`} className="text-[10px] text-teal hover:underline ml-auto">source →</Link>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">{w.detail}</p>
                    {w.why_now && <p className="text-[11px] text-brass mt-1">{w.why_now}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.recent_changes?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight size={14} className="text-brass" />
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Recent changes</p>
              </div>
              <div className="space-y-2">
                {data.recent_changes.map((c: any, i: number) => (
                  <div key={i} className="bg-brass-soft/40 border border-brass/25 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-ink font-medium">{c.what}</p>
                      {c.person && <span className="text-xs text-ink-muted">· {c.person}</span>}
                      <span className="font-mono text-[10px] text-ink-muted ml-auto">{c.confidence} confidence</span>
                    </div>
                    <p className="text-xs text-ink-muted"><span className="line-through opacity-60">{c.from}</span></p>
                    <p className="text-xs text-ink mt-0.5">→ {c.to}</p>
                    {c.meeting_id && (
                      <Link href={`/dashboard/meetings/${c.meeting_id}`} className="text-[10px] text-teal hover:underline">evidence →</Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {data.outstanding_commitments?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Handshake size={14} className="text-teal" />
                  <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Commitments</p>
                </div>
                <div className="space-y-2">
                  {data.outstanding_commitments.map((c: any, i: number) => (
                    <div key={i} className={`border rounded-lg px-4 py-2.5 ${c.status === "overdue" ? "bg-warn-soft border-warn/25" : "bg-surface border-border card-shadow"}`}>
                      <p className="text-sm text-ink">{c.commitment}</p>
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        {c.owed_by === "us" ? "We owe" : "They owe"}{c.person ? ` · ${c.person}` : ""}{c.since ? ` · since ${c.since}` : ""}
                        {c.status === "overdue" && <span className="text-warn font-medium"> · overdue</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.risks?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-warn" />
                  <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Risks</p>
                </div>
                <div className="space-y-2">
                  {data.risks.map((r: any, i: number) => (
                    <div key={i} className="bg-warn-soft border border-warn/20 rounded-lg px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-ink">{r.risk}</p>
                        <span className="font-mono text-[10px] text-warn ml-auto">{r.severity}</span>
                      </div>
                      <p className="text-[11px] text-ink-muted mt-0.5">{r.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {data.open_questions?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle size={14} className="text-ink-muted" />
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Open questions</p>
              </div>
              <div className="space-y-2">
                {data.open_questions.map((q: any, i: number) => (
                  <div key={i} className="bg-surface border border-border rounded-lg px-4 py-2.5 card-shadow">
                    <p className="text-sm text-ink">{q.question}</p>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      {q.raised_by ? `${q.raised_by}` : "unattributed"}{q.since ? ` · open since ${q.since}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.key_contacts?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-teal" />
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Key contacts</p>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {data.key_contacts.map((k: any, i: number) => (
                  <div key={i} className="bg-surface border border-border rounded-lg px-4 py-2.5 card-shadow">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-ink font-medium">{k.name}</p>
                      <span className="font-mono text-[10px] text-ink-muted ml-auto">{k.influence} influence</span>
                    </div>
                    <p className="text-[11px] text-ink-muted mt-0.5">{k.disposition}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
