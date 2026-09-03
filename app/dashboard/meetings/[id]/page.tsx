import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, FileText, ShieldAlert, ClipboardCheck } from "lucide-react";
import { DeleteButton } from "./DeleteButton";
import { MoveMeetingButton } from "./MoveMeetingButton";
import { RetryButton } from "./RetryButton";
import { AutoRefresh } from "./AutoRefresh";
import { WhoIsWho } from "./WhoIsWho";
import { MeetingAudioPlayer } from "./MeetingAudioPlayer";
import { StageTimeline } from "./StageTimeline";
import { MeetingTabs } from "./MeetingTabs";
import { ExtractedFacts } from "./ExtractedFacts";
import { SentimentGraph } from "./SentimentGraph";
import { TranscriptViewer } from "./TranscriptViewer";
import { CustomAnalysis } from "./CustomAnalysis";
import { MomentAnalysis } from "./MomentAnalysis";
import { CrmUpdate } from "./CrmUpdate";
import { Scorecard } from "./Scorecard";

export default async function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings").select("*, clients(id, full_name, email)").eq("id", id).single();
  const { data: facts } = await supabase
    .from("extracted_facts").select("payload, reviewed").eq("meeting_id", id).single();
  const { data: attendeeRows } = await supabase
    .from("meeting_attendees").select("speaker_label, contact_id, contacts(full_name)").eq("meeting_id", id);
  const attendeeNames: Record<string, string> = {};
  const attendeeContactIds: Record<string, string> = {};
  for (const a of attendeeRows ?? []) {
    if (a.speaker_label) {
      attendeeNames[a.speaker_label] = (a.contacts as any)?.full_name ?? "";
      if (a.contact_id) attendeeContactIds[a.speaker_label] = a.contact_id;
    }
  }

  const { data: notes } = await supabase
    .from("internal_notes").select("payload").eq("meeting_id", id).single();

  const isFailed = meeting?.status === "failed";
  const isDone = meeting?.status === "done";
  const isProcessing = ["uploaded", "transcribing", "extracting", "summarizing"].includes(meeting?.status ?? "");

  const statusLabel: Record<string, string> = {
    uploaded: "Preparing…",
    transcribing: "Creating transcript…",
    extracting: "Starting analysis…",
    summarizing: "Extracting information…",
  };

  const sc = facts?.payload?.scorecard;
  const oa = facts?.payload?.objective_assessment;
  const scorecardIsRichFormat = sc && typeof sc.discovery === "object";

  const overviewTab = (
    <>
      {isDone && <MeetingAudioPlayer meetingId={id} />}

      {meeting?.client_summary && (
        <section className="bg-surface border border-border rounded-xl p-8 card-shadow">
          <div className="flex items-center gap-2 mb-5">
            <FileText size={18} className="text-brass" />
            <p className="font-mono text-xs text-brass uppercase tracking-widest">Meeting summary</p>
          </div>
          <div className="text-ink leading-relaxed whitespace-pre-wrap text-base">{meeting.client_summary}</div>
        </section>
      )}

      {sc && (
        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Meeting scorecard</p>
          {oa?.summary && (
            <div className="bg-teal-soft border border-teal/20 rounded-xl p-5 mb-3">
              <p className="text-xs font-mono text-teal uppercase tracking-widest mb-1.5">
                Objective: {oa.achieved === "yes" ? "Achieved" : oa.achieved === "partially" ? "Partially achieved" : oa.achieved === "no" ? "Not achieved" : "Not set"}
              </p>
              <p className="text-sm text-ink">{oa.summary}</p>
              {oa.what_helped && <p className="text-xs text-good mt-2">Helped: {oa.what_helped}</p>}
              {oa.what_hindered && <p className="text-xs text-warn mt-1">Hindered: {oa.what_hindered}</p>}
            </div>
          )}
          {scorecardIsRichFormat ? (
            <Scorecard scorecard={sc} />
          ) : (
            <p className="text-xs text-ink-muted italic">This meeting was processed before the detailed scorecard was added — reprocess to see reasoning per score.</p>
          )}
        </section>
      )}

      {facts?.payload && <ExtractedFacts payload={facts.payload} />}
    </>
  );

  const analysisTab = (
    <>
      {facts?.payload?.stage_timeline && <StageTimeline stages={facts.payload.stage_timeline} />}
      {isDone && <MomentAnalysis meetingId={id} />}
      {isDone && <CrmUpdate meetingId={id} />}
      {isDone && <CustomAnalysis meetingId={id} />}

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
    </>
  );

  const peopleTab = (
    <>
      {isDone && <WhoIsWho meetingId={id} />}
      {facts?.payload?.speaker_sentiment_timeline && (
        <SentimentGraph speakerSentiment={facts.payload.speaker_sentiment_timeline} attendeeNames={attendeeNames}
          attendeeContactIds={attendeeContactIds} clientId={meeting?.clients?.id ?? ""} />
      )}
    </>
  );

  const transcriptTab = (
    <>
      {isDone && <MeetingAudioPlayer meetingId={id} />}
      {isDone && <TranscriptViewer meetingId={id} attendeeNames={attendeeNames}
        attendeeContactIds={attendeeContactIds} clientId={meeting?.clients?.id ?? ""} />}
    </>
  );

  return (
    <main className="max-w-2xl mx-auto px-8 py-10 space-y-6">
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
        {meeting?.objective && <p className="text-sm text-ink-muted mt-1">Objective: {meeting.objective}</p>}
      </div>

      {isFailed && (
        <section className="bg-warn-soft border border-warn/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-ink font-medium">This meeting failed to process.</p>
            <RetryButton meetingId={id} />
          </div>
          <p className="text-xs text-ink-muted">
            Automatic retries were already attempted and didn't succeed. Check your Anthropic account has available credit, then retry.
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

      {isDone && (
        <Link href={`/dashboard/meetings/${id}/review`}
          className="flex items-center justify-center gap-2 bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 hover:opacity-90 transition card-shadow">
          <ClipboardCheck size={16} />
          {facts?.reviewed ? "View review" : "Review this meeting"}
        </Link>
      )}

      {isDone ? (
        <MeetingTabs
          overview={overviewTab}
          analysis={analysisTab}
          people={peopleTab}
          transcript={transcriptTab}
        />
      ) : null}
    </main>
  );
}
