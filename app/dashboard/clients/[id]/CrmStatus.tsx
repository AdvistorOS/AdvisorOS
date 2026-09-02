import { createClient } from "@/lib/supabase/server";
import { GitBranch, ArrowRight, AlertTriangle } from "lucide-react";

const STAGES = ["Prospect", "Discovery", "Proposal", "Negotiation", "Committed", "Closed Won"];

export async function CrmStatus({ clientId }: { clientId: string }) {
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients").select("sales_stage, next_action, risk_note, stage_updated_at").eq("id", clientId).single();

  if (!client?.sales_stage) return null;

  const currentIndex = STAGES.indexOf(client.sales_stage);

  return (
    <section className="bg-surface border border-border rounded-xl p-6 card-shadow">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch size={15} className="text-teal" />
        <p className="font-mono text-xs text-teal uppercase tracking-widest">Pipeline</p>
      </div>

      {currentIndex >= 0 ? (
        <div className="flex items-center gap-1 mb-4 overflow-x-auto">
          {STAGES.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-shrink-0">
              <span className={`text-[10px] font-mono px-2 py-1 rounded-full whitespace-nowrap
                ${i === currentIndex ? "bg-teal text-paper" : i < currentIndex ? "bg-teal-soft text-teal" : "bg-border/40 text-ink-muted"}`}>
                {s}
              </span>
              {i < STAGES.length - 1 && <ArrowRight size={10} className="text-ink-muted flex-shrink-0" />}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink font-medium mb-3">{client.sales_stage}</p>
      )}

      {client.next_action && (
        <div className="bg-good-soft border border-good/20 rounded-lg px-4 py-3 mb-2">
          <p className="text-xs text-ink-muted">Next action</p>
          <p className="text-sm text-ink">{client.next_action}</p>
        </div>
      )}

      {client.risk_note && (
        <div className="bg-warn-soft border border-warn/20 rounded-lg px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={13} className="text-warn flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-ink-muted">Risk</p>
            <p className="text-sm text-ink">{client.risk_note}</p>
          </div>
        </div>
      )}
    </section>
  );
}
