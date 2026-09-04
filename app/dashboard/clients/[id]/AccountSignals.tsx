import { createClient } from "@/lib/supabase/server";
import { AlertTriangle, ArrowRight } from "lucide-react";

export async function AccountSignals({ clientId }: { clientId: string }) {
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients").select("next_action, risk_note").eq("id", clientId).single();

  if (!client?.next_action && !client?.risk_note) return null;

  return (
    <section className="space-y-2">
      {client.next_action && (
        <div className="bg-good-soft border border-good/20 rounded-lg px-4 py-3 flex items-start gap-2">
          <ArrowRight size={14} className="text-good flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-mono text-ink-muted uppercase tracking-widest">Next action</p>
            <p className="text-sm text-ink">{client.next_action}</p>
          </div>
        </div>
      )}
      {client.risk_note && (
        <div className="bg-warn-soft border border-warn/20 rounded-lg px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-warn flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-mono text-ink-muted uppercase tracking-widest">Risk</p>
            <p className="text-sm text-ink">{client.risk_note}</p>
          </div>
        </div>
      )}
    </section>
  );
}
