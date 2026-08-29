import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings").select("*, clients(full_name, email)").eq("id", id).single();
  const { data: facts } = await supabase
    .from("extracted_facts").select("payload").eq("meeting_id", id).single();
  const { data: notes } = await supabase
    .from("internal_notes").select("payload").eq("meeting_id", id).single();

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border px-8 py-5 flex items-center gap-4">
        <Link href="/dashboard" className="text-ink-muted hover:text-brass transition text-sm">
          ← Back
        </Link>
        <span className="font-display text-xl text-ink">AdvisorOS</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-10">
        <div>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-wide">Client</p>
          <h1 className="font-display text-2xl text-ink">{meeting?.clients?.full_name}</h1>
        </div>

        <section className="bg-surface border border-border rounded-sm p-6">
          <p className="font-mono text-xs text-brass uppercase tracking-wide mb-3">Meeting summary</p>
          <p className="text-ink leading-relaxed whitespace-pre-wrap">
            {meeting?.client_summary ?? "Still processing…"}
          </p>
        </section>

        {notes?.payload && (
          <section className="border-l-2 border-brass pl-5">
            <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-2">Adviser notes (internal only)</p>
            <p className="text-sm text-ink mb-1">
              Satisfaction: <span className="font-mono">{notes.payload.overall_satisfaction}</span>
            </p>
            {notes.payload.dissatisfaction_signals?.length > 0 && (
              <p className="text-sm text-warn mb-1">
                Flagged: {notes.payload.dissatisfaction_signals.join("; ")}
              </p>
            )}
            {notes.payload.suggested_actions?.length > 0 && (
              <ul className="text-sm text-ink-muted list-disc list-inside">
                {notes.payload.suggested_actions.map((a: string, i: number) => <li key={i}>{a}</li>)}
              </ul>
            )}
          </section>
        )}

        {facts?.payload && (
          <section>
            <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-3">Extracted facts</p>
            <pre className="font-mono text-xs bg-surface border border-border rounded-sm p-4 overflow-x-auto text-ink-muted">
              {JSON.stringify(facts.payload, null, 2)}
            </pre>
          </section>
        )}
      </main>
    </div>
  );
}
