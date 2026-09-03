"use client";
import { ListChecks, AlertCircle, Sparkles, CheckSquare } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  income: "Income", expenditure: "Expenditure", assets: "Assets", liabilities: "Liabilities",
  pensions: "Pensions", dependants: "Dependants", objectives: "Objectives",
  attitude_to_risk: "Attitude to risk", capacity_for_loss: "Capacity for loss", existing_products: "Existing products",
  revenue: "Revenue", costs: "Costs", margins: "Margins", cash_flow: "Cash flow",
  operations: "Operations", team_structure: "Team structure", growth_objectives: "Growth objectives",
  competitive_position: "Competitive position", risks_challenges: "Risks & challenges",
};

const CONF: Record<string, string> = { high: "bg-good", medium: "bg-brass", low: "bg-warn" };

export function ExtractedFacts({ payload }: { payload: any }) {
  if (!payload) return null;
  const fields = payload.fields ?? [];
  const attention = payload.attention_items ?? [];
  const events = payload.life_events ?? [];
  const actions = payload.action_items ?? [];

  const grouped: Record<string, any[]> = {};
  for (const f of fields) {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  }

  return (
    <div className="space-y-5">
      {fields.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ListChecks size={15} className="text-teal" />
            <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Extracted information</p>
          </div>
          <div className="space-y-4">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-mono text-brass uppercase tracking-wide mb-2">{CATEGORY_LABELS[cat] ?? cat}</p>
                <div className="space-y-2">
                  {items.map((f: any, i: number) => (
                    <div key={i} className="bg-surface border border-border rounded-lg p-4 card-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-ink-muted">{f.label}</p>
                          <p className="font-display text-lg text-ink">{f.value}</p>
                        </div>
                        {f.confidence && <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${CONF[f.confidence] ?? "bg-ink-muted"}`} title={`${f.confidence} confidence`} />}
                      </div>
                      {f.evidence && <p className="text-xs text-ink-muted italic mt-2 pt-2 border-t border-border/60">"{f.evidence}"</p>}
                      {f.change_note && <p className="text-xs text-brass mt-1.5">{f.change_note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {attention.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={15} className="text-warn" />
            <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Still needed</p>
          </div>
          <div className="space-y-2">
            {attention.map((a: any, i: number) => (
              <div key={i} className="bg-warn-soft border border-warn/20 rounded-lg px-4 py-3">
                <p className="text-sm text-ink font-medium">{a.title}</p>
                <p className="text-xs text-ink-muted">{a.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} className="text-brass" />
            <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Notable events</p>
          </div>
          <div className="space-y-2">
            {events.map((e: any, i: number) => (
              <div key={i} className="bg-brass-soft/40 border border-brass/20 rounded-lg px-4 py-3">
                <p className="text-sm text-ink font-medium">{e.title}</p>
                <p className="text-xs text-ink-muted">{e.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {actions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare size={15} className="text-good" />
            <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Actions</p>
          </div>
          <div className="space-y-2">
            {actions.map((a: any, i: number) => (
              <div key={i} className="bg-surface border border-border rounded-lg px-4 py-3 flex justify-between gap-3 card-shadow">
                <p className="text-sm text-ink">{a.description}</p>
                <span className="font-mono text-xs text-ink-muted flex-shrink-0">{a.owner}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
