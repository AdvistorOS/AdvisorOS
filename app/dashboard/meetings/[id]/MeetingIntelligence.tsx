import { createClient } from "@/lib/supabase/server";
import { Brain, ArrowRight, Check, AlertCircle, HelpCircle, TrendingUp } from "lucide-react";

const STATUS_STYLE: Record<string, { cls: string; icon: any; label: string }> = {
  new: { cls: "bg-teal-soft border-teal/25 text-teal", icon: TrendingUp, label: "New" },
  changed: { cls: "bg-brass-soft border-brass/30 text-brass", icon: ArrowRight, label: "Changed" },
  contradicted: { cls: "bg-warn-soft border-warn/30 text-warn", icon: AlertCircle, label: "Contradicted" },
  escalating: { cls: "bg-warn-soft border-warn/30 text-warn", icon: TrendingUp, label: "Escalating" },
  confirmed: { cls: "bg-surface border-border text-ink-muted", icon: Check, label: "Confirmed" },
  resolved: { cls: "bg-good-soft border-good/25 text-good", icon: Check, label: "Resolved" },
  unresolved: { cls: "bg-surface border-border text-ink-muted", icon: HelpCircle, label: "Open" },
};

export async function MeetingIntelligence({ meetingId }: { meetingId: string }) {
  const supabase = await createClient();
  const { data: objects } = await supabase
    .from("intelligence_objects")
    .select("*, contacts(full_name)")
    .eq("meeting_id", meetingId)
    .neq("validation_status", "rejected")
    .neq("object_type", "client_fact")
    .order("temporal_status");

  if (!objects?.length) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Brain size={15} className="text-teal" />
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">What this meeting changed</p>
      </div>
      <div className="space-y-2">
        {objects.map((o: any) => {
          const s = STATUS_STYLE[o.temporal_status] ?? STATUS_STYLE.new;
          const Icon = s.icon;
          return (
            <div key={o.id} className="bg-surface border border-border rounded-lg p-4 card-shadow">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${s.cls}`}>
                  <Icon size={9} className="inline mr-1" />{s.label}
                </span>
                <span className="font-mono text-[10px] text-ink-muted">{o.object_type}</span>
                {o.contacts?.full_name && <span className="text-xs text-ink-muted">· {o.contacts.full_name}</span>}
                {o.evidence_timestamp && (
                  <span className="font-mono text-[10px] text-ink-muted ml-auto">{o.evidence_timestamp}</span>
                )}
              </div>
              <p className="text-sm text-ink font-medium">{o.label}</p>
              <p className="text-sm text-ink-muted mt-0.5">{o.value}</p>
              {o.evidence_quote && (
                <p className="text-xs text-ink-muted italic mt-2 pt-2 border-t border-border/50">"{o.evidence_quote}"</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
