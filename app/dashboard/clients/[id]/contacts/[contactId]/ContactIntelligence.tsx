import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
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

export async function ContactIntelligence({ contactId }: { contactId: string }) {
  const supabase = await createClient();

  const { data: objects } = await supabase
    .from("intelligence_objects")
    .select("*, meetings(created_at)")
    .eq("contact_id", contactId)
    .neq("temporal_status", "superseded")
    .order("created_at", { ascending: false })
    .limit(25);

  if (!objects?.length) {
    return (
      <section className="border border-dashed border-border rounded-xl py-10 text-center">
        <Brain size={20} className="text-ink-muted mx-auto mb-2" />
        <p className="text-sm text-ink-muted">
          No intelligence yet for this person. Map them to a speaker via "Who's who" on a meeting, then reprocess it.
        </p>
      </section>
    );
  }

  const byType: Record<string, any[]> = {};
  for (const o of objects) {
    if (!byType[o.object_type]) byType[o.object_type] = [];
    byType[o.object_type].push(o);
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Brain size={15} className="text-teal" />
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">What we know — with evidence</p>
      </div>
      <div className="space-y-5">
        {Object.entries(byType).map(([type, items]) => (
          <div key={type}>
            <p className="text-xs font-mono text-brass uppercase tracking-wide mb-2">{type.replace(/_/g, " ")}</p>
            <div className="space-y-2">
              {items.map((o: any) => {
                const s = STATUS_STYLE[o.temporal_status] ?? STATUS_STYLE.confirmed;
                const Icon = s.icon;
                return (
                  <div key={o.id} className="bg-surface border border-border rounded-lg p-4 card-shadow">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${s.cls}`}>
                        <Icon size={9} className="inline mr-1" />{s.label}
                      </span>
                      <span className="font-mono text-[10px] text-ink-muted ml-auto">
                        {o.meetings?.created_at ? new Date(o.meetings.created_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <p className="text-sm text-ink font-medium">{o.label}</p>
                    <p className="text-sm text-ink-muted mt-0.5">{o.value}</p>
                    {o.evidence_quote && (
                      <p className="text-xs text-ink-muted italic mt-2 pt-2 border-t border-border/50">
                        "{o.evidence_quote}"
                        {o.evidence_timestamp && <span className="font-mono not-italic ml-1.5">{o.evidence_timestamp}</span>}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="font-mono text-[10px] text-ink-muted">{o.confidence} confidence</span>
                      <span className="font-mono text-[10px] text-ink-muted">{o.validation_status?.replace(/_/g, " ")}</span>
                      {o.meeting_id && (
                        <Link href={`/dashboard/meetings/${o.meeting_id}`} className="text-[10px] text-teal hover:underline ml-auto">
                          Source meeting →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
