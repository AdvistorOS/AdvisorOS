import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, FileText, ShieldAlert, ListChecks, ClipboardCheck } from "lucide-react";
import { DeleteButton } from "./DeleteButton";
import { MoveMeetingButton } from "./MoveMeetingButton";
import { RetryButton } from "./RetryButton";
import { AutoRefresh } from "./AutoRefresh";
import { WhoIsWho } from "./WhoIsWho";
import { CustomAnalysis } from "./CustomAnalysis";
import { MomentAnalysis } from "./MomentAnalysis";
import { CrmUpdate } from "./CrmUpdate";

export default async function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings").select("*, clients(id, full_name, email)").eq("id", id).single();
  const { data: facts } = await supabase
    .from("extracted_facts").select("payload, reviewed").eq("meeting_id", id).single();
  const { data: notes } = await supabase
    .from("internal_notes").select("payload").eq("meeting_id", id).single();

  const isFailed = meeting?.status === "failed";
  const isProcessing = ["uploaded", "transcribing", "extracting", "summarizing"].includes(meeting?.status ?? "");

  const statusLabel: Record<string, string> = {
    uploaded: "Preparing…",
    transcribing: "Creating transcript…",
    extracting: "Starting analysis…",
    summarizing: "Extracting information…",
  };

  return (
    <main className="max-w-2xl mx-auto px-8 py-10 space-y-8">
      {isProcessing && <AutoRefresh meetingId={id} status={meeting?.status ?? ""} />}

      <div className="flex items-start justify-between">
        <Link href="/dashboard/meetings" className="text-ink-muted hover:text-teal transition flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="flex items-center gap-4">
          <MoveMeetingButton meetingId={id} currentClientId={meeting?.clients?.id} />
          <DeleteButton meetingId={id} />
        </div>
      </div>

      <div>
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Client</p>
        <h1 className="font-display text-3xl text-ink mt-1">{meeting?.clients?.full_name}</h1>
      </div>

      {isFailed && (
        <section className="bg-warn-soft border border-warn/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-ink font-medium">This meeting failed to process.</p>
            <RetryButton meetingId={id} />
          </div>
          <p className="text-xs text-ink-muted">
            Automatic retries were already attempted and didn't succeed — this is a genuine failure,
            not a false alarm. Check your Anthropic account has available credit, then retry.
          </p>
        </section>
      )}

      {isProcessing && (
        <section className="bg-teal-soft border border-teal/20 rounded-xl p-6">
          <p className="text-sm text-ink">Processing — {statusLabel[meeting?.status ?? ""] ?? "working…"}</p>
          {(meeting?.status === "extracting" || meeting?.status === "summarizing") && (
            <p className="text-xs text-ink-muted mt-1">
              This page retries automatically in the background — no action needed. Leave it open.
            </p>
          )}
        </section>
      )}

      {meeting?.status === "done" && (
        <Link href={`/dashboard/meetings/${id}/review`}
          className="flex items-center justify-center gap-2 bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 hover:opacity-90 transition card-shadow">
          <ClipboardCheck size={16} />
          {facts?.reviewed ? "View review" : "Review this meeting"}
        </Link>
      )}

      {meeting?.status === "done" && <WhoIsWho meetingId={id} />}

      {meeting?.status === "done" && <CrmUpdate meetingId={id} />}

      {meeting?.status === "done" && <MomentAnalysis meetingId={id} />}

      {meeting?.status === "done" && <CustomAnalysis meetingId={id} />}

      {meeting?.client_summary && (
        <section className="bg-surface border border-border rounded-xl p-7 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-brass" />
            <p className="font-mono text-xs text-brass uppercase tracking-widest">Meeting summary</p>
          </div>
          <p className="text-ink leading-relaxed whitespace-pre-wrap text-[15px]">{meeting.client_summary}</p>
        </section>
      )}

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
            <p className="text-sm text-warn mb-2">Flagged: {notes.payload.dissatisfaction_signals.join("; ")}</p>
          )}
          {notes.payload.suggested_actions?.length > 0 && (
            <ul className="text-sm text-ink-muted list-disc list-inside space-y-1">
              {notes.payload.suggested_actions.map((a: string, i: number) => <li key={i}>{a}</li>)}
            </ul>
          )}
        </section>
      )}

      {facts?.payload?.scorecard && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Meeting scorecard</p>
          </div>
          {facts.payload.objective_assessment?.summary && (
            <div className="bg-teal-soft border border-teal/20 rounded-xl p-5 mb-3">
              <p className="text-xs font-mono text-teal uppercase tracking-widest mb-1.5">
                Objective: {facts.payload.objective_assessment.achieved === "yes" ? "Achieved" : facts.payload.objective_assessment.achieved === "partially" ? "Partially achieved" : facts.payload.objective_assessment.achieved === "no" ? "Not achieved" : "Not set"}
              </p>
              <p className="text-sm text-ink">{facts.payload.objective_assessment.summary}</p>
              {facts.payload.objective_assessment.what_helped && (
                <p className="text-xs text-good mt-2">Helped: {facts.payload.objective_assessment.what_helped}</p>
              )}
              {facts.payload.objective_assessment.what_hindered && (
                <p className="text-xs text-warn mt-1">Hindered: {facts.payload.objective_assessment.what_hindered}</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(facts.payload.scorecard).filter(([k]) => k !== "overall").map(([key, value]: [string, any]) => (
              <div key={key} className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
                <p className="text-xs text-ink-muted capitalize">{key.replace(/_/g, " ")}</p>
                <p className="font-display text-xl text-ink">{value}<span className="text-xs text-ink-muted">/10</span></p>
              </div>
            ))}
          </div>
          {typeof facts.payload.scorecard.overall === "number" && (
            <div className="bg-ink text-paper rounded-lg px-4 py-3 mt-2.5 flex items-center justify-between">
              <p className="text-sm">Overall</p>
              <p className="font-display text-xl">{facts.payload.scorecard.overall}<span className="text-xs opacity-70">/10</span></p>
            </div>
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
  );
}
