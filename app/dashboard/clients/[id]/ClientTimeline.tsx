import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Clock3, Target, AlertTriangle } from "lucide-react";

export async function ClientTimeline({ clientId }: { clientId: string }) {
  const supabase = await createClient();
  const { data: meetings } = await supabase
    .from("meetings").select("id, created_at, objective, status")
    .eq("client_id", clientId).order("created_at", { ascending: false });
  const { data: factsRows } = await supabase
    .from("extracted_facts").select("meeting_id, payload").in("meeting_id", (meetings ?? []).map((m) => m.id));

  const factsByMeeting: Record<string, any> = {};
  for (const f of factsRows ?? []) factsByMeeting[f.meeting_id] = f.payload;

  if (!meetings?.length) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Clock3 size={15} className="text-teal" />
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Timeline</p>
      </div>
      <div className="space-y-3">
        {meetings.map((m: any) => {
          const facts = factsByMeeting[m.id];
          const objAssessment = facts?.objective_assessment;
          const lifeEvents = facts?.life_events ?? [];
          return (
            <Link key={m.id} href={`/dashboard/meetings/${m.id}`}
              className="block bg-surface border border-border rounded-lg px-4 py-3.5 card-shadow card-shadow-hover transition">
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-mono text-xs text-ink-muted">{new Date(m.created_at).toLocaleDateString()}</p>
                <span className="font-mono text-xs text-ink-muted">{m.status}</span>
              </div>
              {m.objective && (
                <p className="text-sm text-ink flex items-center gap-1.5 mb-1">
                  <Target size={12} className="text-teal flex-shrink-0" />
                  {m.objective}
                  {objAssessment?.achieved && (
                    <span className={`text-xs font-mono ml-1 ${objAssessment.achieved === "yes" ? "text-good" : objAssessment.achieved === "no" ? "text-warn" : "text-brass"}`}>
                      — {objAssessment.achieved === "yes" ? "achieved" : objAssessment.achieved === "no" ? "not achieved" : "partial"}
                    </span>
                  )}
                </p>
              )}
              {lifeEvents.length > 0 && (
                <div className="flex items-start gap-1.5 mt-1">
                  <AlertTriangle size={12} className="text-brass flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-ink-muted">{lifeEvents.map((le: any) => le.title).join(", ")}</p>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
