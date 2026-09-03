"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { PoundSterling, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { LoadingDots } from "../LoadingDots";

const STAGES = ["Prospect", "Discovery", "Proposal", "Negotiation", "Committed", "Closed Won", "Closed Lost"];
const PROBABILITY: Record<string, number> = {
  Prospect: 0.1, Discovery: 0.25, Proposal: 0.45, Negotiation: 0.65,
  Committed: 0.85, "Closed Won": 1, "Closed Lost": 0,
};

export default function PipelinePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("clients")
      .select("id, full_name, sales_stage, deal_value, next_action, risk_note, stage_updated_at")
      .eq("adviser_id", user.id);

    setClients(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function saveValue(clientId: string) {
    const num = parseFloat(editValue.replace(/[^0-9.]/g, ""));
    await supabase.from("clients").update({ deal_value: isNaN(num) ? null : num }).eq("id", clientId);
    setEditing(null);
    setEditValue("");
    load();
  }

  if (loading) return <main className="max-w-3xl mx-auto px-8"><LoadingDots label="Loading pipeline…" /></main>;

  const open = clients.filter((c) => c.sales_stage && !["Closed Won", "Closed Lost"].includes(c.sales_stage));
  const won = clients.filter((c) => c.sales_stage === "Closed Won");

  const totalValue = open.reduce((s, c) => s + (c.deal_value ?? 0), 0);
  const weighted = open.reduce((s, c) => s + (c.deal_value ?? 0) * (PROBABILITY[c.sales_stage] ?? 0), 0);
  const wonValue = won.reduce((s, c) => s + (c.deal_value ?? 0), 0);

  const byStage = STAGES.filter((s) => !["Closed Won", "Closed Lost"].includes(s))
    .map((stage) => ({ stage, clients: open.filter((c) => c.sales_stage === stage) }))
    .filter((g) => g.clients.length > 0);

  const fmt = (n: number) => "£" + Math.round(n).toLocaleString();

  return (
    <main className="max-w-3xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink mb-1">Pipeline</h1>
        <p className="text-ink-muted text-sm">Open deals, weighted forecast, and what needs attention.</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
          <p className="text-xs text-ink-muted flex items-center gap-1.5"><PoundSterling size={11} /> Open pipeline</p>
          <p className="font-display text-2xl text-ink">{fmt(totalValue)}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
          <p className="text-xs text-ink-muted flex items-center gap-1.5"><TrendingUp size={11} /> Weighted</p>
          <p className="font-display text-2xl text-teal">{fmt(weighted)}</p>
        </div>
        <div className="bg-good-soft border border-good/20 rounded-lg px-4 py-3">
          <p className="text-xs text-ink-muted">Closed won</p>
          <p className="font-display text-2xl text-good">{fmt(wonValue)}</p>
        </div>
      </div>

      {byStage.length === 0 && (
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <PoundSterling size={22} className="text-ink-muted mx-auto mb-3" />
          <p className="text-sm text-ink-muted">No clients have a sales stage yet. Run "Update client record" on a meeting to set one.</p>
        </div>
      )}

      {byStage.map((group) => {
        const stageTotal = group.clients.reduce((s, c) => s + (c.deal_value ?? 0), 0);
        return (
          <section key={group.stage}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">
                {group.stage} · {group.clients.length}
              </p>
              <p className="font-mono text-xs text-ink-muted">
                {fmt(stageTotal)} · {Math.round((PROBABILITY[group.stage] ?? 0) * 100)}% likely
              </p>
            </div>
            <div className="space-y-2">
              {group.clients.map((c) => (
                <div key={c.id} className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/dashboard/clients/${c.id}`} className="text-sm text-ink font-medium hover:text-teal transition">
                      {c.full_name}
                    </Link>
                    {editing === c.id ? (
                      <div className="flex items-center gap-1.5">
                        <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveValue(c.id)}
                          placeholder="0"
                          className="border border-border rounded-md px-2 py-1 text-xs w-24 bg-paper text-ink focus:outline-none focus:border-teal" />
                        <button onClick={() => saveValue(c.id)} className="text-xs text-teal">Save</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditing(c.id); setEditValue(String(c.deal_value ?? "")); }}
                        className="font-mono text-sm text-ink hover:text-teal transition">
                        {c.deal_value ? fmt(c.deal_value) : "+ add value"}
                      </button>
                    )}
                  </div>
                  {c.next_action && <p className="text-xs text-ink-muted mt-1.5">→ {c.next_action}</p>}
                  {c.risk_note && (
                    <p className="text-xs text-warn mt-1 flex items-start gap-1">
                      <AlertCircle size={11} className="flex-shrink-0 mt-0.5" /> {c.risk_note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
