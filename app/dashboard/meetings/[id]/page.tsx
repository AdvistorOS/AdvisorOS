import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, FileText, ShieldAlert, ListChecks, ClipboardCheck } from "lucide-react";
import { DeleteButton } from "./DeleteButton";
import { MoveMeetingButton } from "./MoveMeetingButton";

export default async function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings").select("*, clients(id, full_name, email)").eq("id", id).single();
  const { data: facts } = await supabase
    .from("extracted_facts").select("payload, reviewed").eq("meeting_id", id).single();
  const { data: notes } = await supabase
    .from("internal_notes").select("payload").eq("meeting_id", id).single();

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border px-8 py-5 flex items-center gap-4">
        <Link href="/dashboard" className="text-ink-muted hover:text-teal transition flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} />
          Back
        </Link>
        <span className="font-display text-xl text-ink ml-2">AdvisorOS</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Client</p>
            <h1 className="font-display text-3xl text-ink mt-1">{meeting?.clients?.full_name}</h1>
          </div>
          <div className="flex items-center gap-4">
            <MoveMeetingButton meetingId={id} currentClientId={meeting?.clients?.id} />
            <DeleteButton meetingId={id} />
          </div>
        </div>

        <Link href={`/dashboard/meetings/${id}/review`}
          className="flex items-center justify-center gap-2 bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 hover:opacity-90 transition card-shadow">
          <ClipboardCheck size={16} />
          {facts?.reviewed ? "View review" : "Review this meeting"}
        </Link>

        <section className="bg-surface border border-border rounded-xl p-7 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-brass" />
            <p className="font-mono text-xs text-brass uppercase tracking-widest">Meeting summary</p>
          </div>
          <p className="text-ink leading-relaxed whitespace-pre-wrap text-[15px]">
            {meeting?.client_summary ?? "Still processing…"}
          </p>
        </section>

        {notes?.payload && (
          <section className="bg-brass-soft/40 border border-brass/20 rounded-xl p-7">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert size={16} className="text-brass" />
              <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Adviser notes — internal only</p>
            </div>
            <p className="text-sm text-ink mb-2">
              Satisfaction: <span className="font-mono font-medium">{notes.payload.overall_satisfaction}</span>
            </p>
            {notes.payload.dissatisfaction_signals?.length > 0 && (
              <p className="text-sm text-warn mb-2">
                Flagged: {notes.payload.dissatisfaction_signals.join("; ")}
              </p>
            )}
            {notes.payload.suggested_actions?.length > 0 && (
              <ul className="text-sm text-ink-muted list-disc list-inside space-y-1">
                {notes.payload.suggested_actions.map((a: string, i: number) => <li key={i}>{a}</li>)}
              </ul>
            )}
          </section>
        )}

        {facts?.payload && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ListChecks size={16} className="text-ink-muted" />
              <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Extracted facts</p>
            </div>
            <pre className="font-mono text-xs bg-surface border border-border rounded-xl p-5 overflow-x-auto text-ink-muted card-shadow">
              {JSON.stringify(facts.payload, null, 2)}
            </pre>
          </section>
        )}
      </main>
    </div>
  );
}
