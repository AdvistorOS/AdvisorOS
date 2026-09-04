import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Calendar, ArrowRight, Check, AlertCircle, HelpCircle, TrendingUp, CheckSquare } from "lucide-react";

const ICONS: Record<string, any> = {
  new: TrendingUp, changed: ArrowRight, contradicted: AlertCircle,
  escalating: TrendingUp, confirmed: Check, resolved: Check, unresolved: HelpCircle,
};

const COLORS: Record<string, string> = {
  new: "text-teal", changed: "text-brass", contradicted: "text-warn",
  escalating: "text-warn", confirmed: "text-ink-muted", resolved: "text-good", unresolved: "text-ink-muted",
};

export async function AccountTimeline({ clientId }: { clientId: string }) {
  const supabase = await createClient();

  const { data: meetings } = await supabase
    .from("meetings").select("id, created_at, title, objective, client_summary, status")
    .eq("client_id", clientId).eq("status", "done").order("created_at", { ascending: false });

  if (!meetings?.length) return null;

  const { data: intel } = await supabase
    .from("intelligence_objects")
    .select("id, meeting_id, object_type, label, value, temporal_status, evidence_timestamp, contacts(full_name)")
    .eq("client_id", clientId).neq("validation_status", "rejected");

  const { data: actions } = await supabase
    .from("actions").select("id, meeting_id, description, owner, status").eq("client_id", clientId);

  const intelByMeeting: Record<string, any[]> = {};
  for (const i of intel ?? []) {
    if (!i.meeting_id) continue;
    (intelByMeeting[i.meeting_id] ??= []).push(i);
  }

  const actionsByMeeting: Record<string, any[]> = {};
  for (const a of actions ?? []) {
    if (!a.meeting_id) continue;
    (actionsByMeeting[a.meeting_id] ??= []).push(a);
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={15} className="text-teal" />
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Account timeline</p>
      </div>
      <div className="space-y-4">
        {meetings.map((m: any) => {
          const events = intelByMeeting[m.id] ?? [];
          const acts = actionsByMeeting[m.id] ?? [];
          return (
            <div key={m.id} className="border-l-2 border-border pl-4 relative">
              <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-teal" />
              <div className="flex items-baseline gap-2 flex-wrap mb-1.5">
                <p className="font-mono text-xs text-ink font-medium">
                  {new Date(m.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <Link href={`/dashboard/meetings/${m.id}`} className="text-sm text-teal hover:underline">
                  {m.title || m.objective || "Meeting"}
                </Link>
              </div>

              {events.length > 0 && (
                <ul className="space-y-1 mb-2">
                  {events.map((e: any) => {
                    const Icon = ICONS[e.temporal_status] ?? Check;
                    return (
                      <li key={e.id} className="flex items-start gap-2 text-xs">
                        <Icon size={11} className={`flex-shrink-0 mt-0.5 ${COLORS[e.temporal_status] ?? "text-ink-muted"}`} />
                        <span className="text-ink">
                          {e.label}
                          {e.contacts?.full_name && <span className="text-ink-muted"> — {e.contacts.full_name}</span>}
                          {e.evidence_timestamp && <span className="font-mono text-ink-muted ml-1.5">{e.evidence_timestamp}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {acts.length > 0 && (
                <ul className="space-y-1">
                  {acts.map((a: any) => (
                    <li key={a.id} className="flex items-start gap-2 text-xs">
                      <CheckSquare size={11} className={`flex-shrink-0 mt-0.5 ${a.status === "done" ? "text-good" : "text-ink-muted"}`} />
                      <span className={a.status === "done" ? "text-ink-muted line-through" : "text-ink"}>
                        {a.description} <span className="text-ink-muted">({a.owner})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {events.length === 0 && acts.length === 0 && m.client_summary && (
                <p className="text-xs text-ink-muted line-clamp-2">{m.client_summary}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
