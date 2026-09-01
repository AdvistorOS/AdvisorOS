import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, Clock3, StickyNote, TrendingUp } from "lucide-react";
import { BriefCard } from "./BriefCard";
import { DeleteClientButton } from "./DeleteClientButton";

const CATEGORY_LABELS: Record<string, string> = {
  income: "Income", expenditure: "Expenditure", assets: "Assets", liabilities: "Liabilities",
  pensions: "Pensions", dependants: "Dependants", objectives: "Objectives",
  attitude_to_risk: "Attitude to risk", capacity_for_loss: "Capacity for loss", existing_products: "Existing products",
  revenue: "Revenue", costs: "Costs", margins: "Margins", cash_flow: "Cash flow",
  operations: "Operations", team_structure: "Team structure", growth_objectives: "Growth objectives",
  competitive_position: "Competitive position", risks_challenges: "Risks & challenges",
};

const CONFIDENCE_DOT: Record<string, string> = {
  high: "bg-good", medium: "bg-brass", low: "bg-warn",
};

export default async function ClientRecord({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).single();
  const { data: clientFacts } = await supabase.from("client_facts").select("*").eq("client_id", id).is("superseded_by", null);
  const { data: actions } = await supabase.from("actions").select("*").eq("client_id", id).eq("status", "open");
  const { data: meetings } = await supabase.from("meetings").select("id, created_at, status").eq("client_id", id).order("created_at", { ascending: false });
  const { count: noteCount } = await supabase.from("client_notes").select("*", { count: "exact", head: true }).eq("client_id", id);

  const { data: allVersions } = await supabase.from("client_facts").select("category").eq("client_id", id);
  const confirmCounts: Record<string, number> = {};
  for (const v of allVersions ?? []) {
    confirmCounts[v.category] = (confirmCounts[v.category] ?? 0) + 1;
  }

  const grouped: Record<string, any[]> = {};
  for (const f of clientFacts ?? []) {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  }

  return (
    <main className="max-w-2xl mx-auto px-8 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/clients" className="text-ink-muted hover:text-teal transition flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} /> Back
        </Link>
        <DeleteClientButton clientId={id} />
      </div>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-ink">{client?.full_name}</h1>
        <Link href={`/dashboard/clients/${id}/notes`}
          className="flex items-center gap-1.5 bg-surface border border-border rounded-md px-3.5 py-2 text-xs text-ink hover:bg-teal-soft hover:border-teal transition card-shadow">
          <StickyNote size={13} className="text-teal" />
          Notes {noteCount ? `(${noteCount})` : ""}
        </Link>
      </div>

      <BriefCard clientId={id} />

      {actions && actions.length > 0 && (
        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Open actions</p>
          <div className="space-y-2">
            {actions.map((a: any) => (
              <div key={a.id} className="bg-surface border border-border rounded-lg px-4 py-3 text-sm text-ink flex justify-between card-shadow">
                <span>{a.description}</span>
                <span className="font-mono text-xs text-ink-muted">{a.owner}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Client record</p>
        {!clientFacts?.length && <p className="text-sm text-ink-muted">No confirmed facts yet.</p>}
        <div className="space-y-5">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-mono text-brass uppercase tracking-wide">{CATEGORY_LABELS[category] ?? category}</p>
                {confirmCounts[category] > 1 && (
                  <span className="flex items-center gap-1 text-[10px] text-good font-mono bg-good-soft px-1.5 py-0.5 rounded-full">
                    <TrendingUp size={9} /> confirmed {confirmCounts[category]}×
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {items.map((f: any) => (
                  <div key={f.id} className="bg-surface border border-border rounded-lg p-4 card-shadow">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-ink-muted">{f.data.label}</p>
                      {f.data.confidence && (
                        <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT[f.data.confidence] ?? "bg-ink-muted"}`} title={`${f.data.confidence} confidence`} />
                      )}
                    </div>
                    <p className="font-display text-lg text-ink">{f.data.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Meeting history</p>
        <div className="space-y-2">
          {meetings?.map((m: any) => (
            <Link key={m.id} href={`/dashboard/meetings/${m.id}`}
              className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3 card-shadow card-shadow-hover transition">
              <p className="font-mono text-xs text-ink-muted flex items-center gap-1.5">
                <Clock3 size={11} /> {new Date(m.created_at).toLocaleDateString()}
              </p>
              <span className="font-mono text-xs text-ink-muted">{m.status}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
