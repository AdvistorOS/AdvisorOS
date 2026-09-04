"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Sun, AlertTriangle, Clock, CheckSquare, ArrowRight } from "lucide-react";
import { LoadingDots } from "../LoadingDots";

const STALE_DAYS = 21;

export default function TodayPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState<any[]>([]);
  const [atRisk, setAtRisk] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [unreviewed, setUnreviewed] = useState<any[]>([]);
  const [unresolved, setUnresolved] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: clients } = await supabase
        .from("clients").select("id, full_name, sales_stage, next_action, risk_note").eq("adviser_id", user.id);

      const { data: meetings } = await supabase
        .from("meetings").select("id, client_id, created_at, status, clients(full_name)")
        .eq("adviser_id", user.id).order("created_at", { ascending: false });

      const lastSeen: Record<string, string> = {};
      for (const m of meetings ?? []) {
        if (!lastSeen[m.client_id]) lastSeen[m.client_id] = m.created_at;
      }

      const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
      const staleClients = (clients ?? []).filter((c) => {
        if (["Closed Won", "Closed Lost"].includes(c.sales_stage ?? "")) return false;
        const last = lastSeen[c.id];
        if (!last) return true;
        return new Date(last).getTime() < cutoff;
      }).map((c) => ({
        ...c,
        daysSince: lastSeen[c.id]
          ? Math.floor((Date.now() - new Date(lastSeen[c.id]).getTime()) / 86400000)
          : null,
      }));

      setStale(staleClients);
      setAtRisk((clients ?? []).filter((c) => c.risk_note));

      const clientIds = (clients ?? []).map((c) => c.id);
      const { data: unresolvedIntel } = await supabase
        .from("intelligence_objects")
        .select("id, label, value, object_type, client_id, clients(full_name), contacts(full_name)")
        .in("client_id", clientIds.length ? clientIds : ["00000000-0000-0000-0000-000000000000"])
        .in("temporal_status", ["unresolved", "escalating", "contradicted"])
        .neq("validation_status", "rejected")
        .limit(10);
      setUnresolved(unresolvedIntel ?? []);

      const { data: openActions } = await supabase
        .from("actions").select("id, description, owner, client_id, clients(full_name)")
        .eq("status", "open").limit(10);
      setActions(openActions ?? []);

      const doneMeetings = (meetings ?? []).filter((m) => m.status === "done").map((m) => m.id);
      const { data: factsRows } = await supabase
        .from("extracted_facts").select("meeting_id, reviewed").in("meeting_id", doneMeetings);
      const unreviewedIds = (factsRows ?? []).filter((f) => !f.reviewed).map((f) => f.meeting_id);
      setUnreviewed((meetings ?? []).filter((m) => unreviewedIds.includes(m.id)).slice(0, 5));

      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <main className="max-w-2xl mx-auto px-8"><LoadingDots label="Loading…" /></main>;

  const nothingToDo = !stale.length && !atRisk.length && !actions.length && !unreviewed.length && !unresolved.length;

  return (
    <main className="max-w-2xl mx-auto px-8 py-10 space-y-6">
      <div className="flex items-center gap-2">
        <Sun size={20} className="text-brass" />
        <h1 className="font-display text-3xl text-ink">Today</h1>
      </div>

      {nothingToDo && (
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <CheckSquare size={22} className="text-good mx-auto mb-3" />
          <p className="text-sm text-ink-muted">Nothing needs attention. Everything's reviewed and up to date.</p>
        </div>
      )}

      {unreviewed.length > 0 && (
        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-2">Meetings awaiting review</p>
          <div className="space-y-2">
            {unreviewed.map((m: any) => (
              <Link key={m.id} href={`/dashboard/meetings/${m.id}/review`}
                className="flex items-center justify-between bg-teal-soft border border-teal/20 rounded-lg px-4 py-3 hover:opacity-90 transition">
                <div>
                  <p className="text-sm text-ink font-medium">{m.clients?.full_name}</p>
                  <p className="text-xs text-ink-muted">{new Date(m.created_at).toLocaleDateString()}</p>
                </div>
                <ArrowRight size={14} className="text-teal" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {unresolved.length > 0 && (
        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-2">Unresolved across clients</p>
          <div className="space-y-2">
            {unresolved.map((u: any) => (
              <Link key={u.id} href={`/dashboard/clients/${u.client_id}`}
                className="block bg-brass-soft/40 border border-brass/25 rounded-lg px-4 py-3 hover:opacity-90 transition">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm text-ink font-medium">{u.label}</p>
                  <span className="font-mono text-[10px] text-ink-muted ml-auto">{u.clients?.full_name}</span>
                </div>
                <p className="text-xs text-ink-muted">{u.value}</p>
                {u.contacts?.full_name && <p className="text-[10px] text-ink-muted mt-1">— {u.contacts.full_name}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {atRisk.length > 0 && (
        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-2">At risk</p>
          <div className="space-y-2">
            {atRisk.map((c) => (
              <Link key={c.id} href={`/dashboard/clients/${c.id}`}
                className="block bg-warn-soft border border-warn/20 rounded-lg px-4 py-3 hover:opacity-90 transition">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={12} className="text-warn flex-shrink-0" />
                  <p className="text-sm text-ink font-medium">{c.full_name}</p>
                  {c.sales_stage && <span className="font-mono text-[10px] text-ink-muted ml-auto">{c.sales_stage}</span>}
                </div>
                <p className="text-xs text-ink-muted mt-1">{c.risk_note}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {stale.length > 0 && (
        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-2">
            No contact in {STALE_DAYS}+ days
          </p>
          <div className="space-y-2">
            {stale.map((c) => (
              <Link key={c.id} href={`/dashboard/clients/${c.id}`}
                className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3 card-shadow hover:border-teal/40 transition">
                <div>
                  <p className="text-sm text-ink font-medium">{c.full_name}</p>
                  {c.next_action && <p className="text-xs text-ink-muted">→ {c.next_action}</p>}
                </div>
                <span className="font-mono text-xs text-ink-muted flex items-center gap-1 flex-shrink-0">
                  <Clock size={11} />
                  {c.daysSince === null ? "never" : `${c.daysSince}d`}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {actions.length > 0 && (
        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-2">Open actions</p>
          <div className="space-y-2">
            {actions.map((a: any) => (
              <Link key={a.id} href={`/dashboard/clients/${a.client_id}`}
                className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3 card-shadow hover:border-teal/40 transition">
                <div>
                  <p className="text-sm text-ink">{a.description}</p>
                  <p className="text-xs text-ink-muted">{a.clients?.full_name}</p>
                </div>
                <span className="font-mono text-xs text-ink-muted flex-shrink-0">{a.owner}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
