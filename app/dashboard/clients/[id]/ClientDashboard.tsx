import { createClient } from "@/lib/supabase/server";
import { TrendingUp, Target, Gauge } from "lucide-react";

export async function ClientDashboard({ clientId }: { clientId: string }) {
  const supabase = await createClient();

  const { data: meetings } = await supabase
    .from("meetings").select("id, created_at").eq("client_id", clientId).eq("status", "done").order("created_at");
  if (!meetings?.length) return null;

  const { data: factsRows } = await supabase
    .from("extracted_facts").select("meeting_id, payload").in("meeting_id", meetings.map((m) => m.id));

  const factsByMeeting: Record<string, any> = {};
  for (const f of factsRows ?? []) factsByMeeting[f.meeting_id] = f.payload;

  let achieved = 0, partial = 0, missed = 0, assessedCount = 0;
  const overallScores: { date: string; score: number }[] = [];

  for (const m of meetings) {
    const f = factsByMeeting[m.id];
    if (!f) continue;
    const a = f.objective_assessment?.achieved;
    if (a === "yes") { achieved++; assessedCount++; }
    else if (a === "partially") { partial++; assessedCount++; }
    else if (a === "no") { missed++; assessedCount++; }
    if (typeof f.scorecard?.overall === "number") {
      overallScores.push({ date: new Date(m.created_at).toLocaleDateString(), score: f.scorecard.overall });
    }
  }

  if (!assessedCount && !overallScores.length) return null;

  const avgScore = overallScores.length
    ? (overallScores.reduce((s, x) => s + x.score, 0) / overallScores.length).toFixed(1)
    : null;
  const trend = overallScores.length >= 2
    ? overallScores[overallScores.length - 1].score - overallScores[0].score
    : null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Gauge size={15} className="text-teal" />
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Account performance</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {assessedCount > 0 && (
          <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
            <p className="text-xs text-ink-muted flex items-center gap-1.5"><Target size={11} /> Objectives met</p>
            <p className="font-display text-xl text-ink">
              {achieved}<span className="text-sm text-ink-muted">/{assessedCount}</span>
            </p>
            {partial > 0 && <p className="text-xs text-brass">{partial} partial</p>}
          </div>
        )}
        {avgScore && (
          <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
            <p className="text-xs text-ink-muted flex items-center gap-1.5"><TrendingUp size={11} /> Avg meeting score</p>
            <p className="font-display text-xl text-ink">{avgScore}<span className="text-sm text-ink-muted">/10</span></p>
            {trend !== null && trend !== 0 && (
              <p className={`text-xs ${trend > 0 ? "text-good" : "text-warn"}`}>
                {trend > 0 ? "↑" : "↓"} {Math.abs(trend)} since first
              </p>
            )}
          </div>
        )}
      </div>
      {overallScores.length >= 2 && (
        <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow mt-2.5">
          <p className="text-xs text-ink-muted mb-2">Score by meeting</p>
          <div className="flex items-end gap-1.5 h-16">
            {overallScores.map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${s.date}: ${s.score}/10`}>
                <div className="w-full bg-teal rounded-t transition-all" style={{ height: `${Math.max(s.score * 10, 6)}%` }} />
                <span className="font-mono text-[9px] text-ink-muted">{s.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
