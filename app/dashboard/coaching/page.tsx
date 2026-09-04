"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { GraduationCap, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus, Target, Play, AlertTriangle, Award, Info } from "lucide-react";

const TREND_ICON: Record<string, any> = { improving: TrendingUp, worsening: TrendingDown, steady: Minus, insufficient_data: Info };
const TREND_CLS: Record<string, string> = { improving: "text-good", worsening: "text-warn", steady: "text-ink-muted", insufficient_data: "text-ink-muted" };

function Delta({ now, before, label, higherIsBetter = true }: { now?: number; before?: number; label: string; higherIsBetter?: boolean }) {
  if (now === undefined) return null;
  const diff = before !== undefined ? Math.round((now - before) * 10) / 10 : null;
  const good = diff === null ? null : higherIsBetter ? diff > 0 : diff < 0;
  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
      <p className="text-xs text-ink-muted capitalize">{label.replace(/_/g, " ")}</p>
      <div className="flex items-baseline gap-2">
        <p className="font-display text-xl text-ink">{now}</p>
        {diff !== null && diff !== 0 && (
          <span className={`font-mono text-xs ${good ? "text-good" : "text-warn"}`}>
            {diff > 0 ? "↑" : "↓"} {Math.abs(diff)}
          </span>
        )}
      </div>
      {before !== undefined && <p className="font-mono text-[10px] text-ink-muted">was {before}</p>}
    </div>
  );
}

export default function CoachingPage() {
  const supabase = createClient();
  const [a, setA] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("coaching_patterns").select("payload").eq("pattern_type", "full_analysis")
      .maybeSingle().then(({ data }) => {
        if (data?.payload) {
          setA((data.payload as any).analysis);
          setMetrics({ recent: (data.payload as any).recentStats, previous: (data.payload as any).prevStats });
        }
      });
  }, []);

  async function run() {
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/coaching-patterns", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (data.analysis) { setA(data.analysis); setMetrics(data.metrics); setMeta(data); }
    else setMsg(data.message ?? data.error ?? "Nothing returned");
  }

  const r = metrics?.recent, p = metrics?.previous;

  return (
    <main className="max-w-3xl mx-auto px-8 py-10 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink mb-1">Coaching</h1>
          <p className="text-ink-muted text-sm">Patterns in how you actually sell, drawn from your real meetings.</p>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-2 bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 hover:opacity-90 transition disabled:opacity-50 flex-shrink-0">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {loading ? "Analysing…" : a ? "Refresh" : "Analyse"}
        </button>
      </div>

      {msg && (
        <div className="border border-dashed border-border rounded-xl py-12 text-center">
          <GraduationCap size={22} className="text-ink-muted mx-auto mb-3" />
          <p className="text-sm text-ink-muted">{msg}</p>
        </div>
      )}

      {meta && !meta.userIdentified && (
        <div className="bg-brass-soft/40 border border-brass/25 rounded-lg px-4 py-3 flex items-start gap-2">
          <Info size={13} className="text-brass flex-shrink-0 mt-0.5" />
          <p className="text-xs text-ink">
            You haven't been identified as a speaker in these meetings. Add yourself as an attendee with type "Me",
            map yourself in "Who's who", then rebuild — coaching gets substantially more accurate.
          </p>
        </div>
      )}

      {r && (
        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">
            Last {r.count} meetings vs previous {p?.count ?? 0}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {Object.keys(r.avgs ?? {}).filter((k) => k !== "overall").slice(0, 8).map((k) => (
              <Delta key={k} label={k} now={r.avgs[k]} before={p?.avgs?.[k]} />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-2.5">
            <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
              <p className="text-xs text-ink-muted">Objectives met</p>
              <p className="font-display text-xl text-ink">{r.objAchieved}<span className="text-xs text-ink-muted">/{r.objAssessed}</span></p>
              {p?.objAssessed > 0 && <p className="font-mono text-[10px] text-ink-muted">was {p.objAchieved}/{p.objAssessed}</p>}
            </div>
            <Delta label="brilliant moves" now={r.momentCounts?.brilliant} before={p?.momentCounts?.brilliant} />
            <Delta label="mistakes" now={r.momentCounts?.mistake} before={p?.momentCounts?.mistake} higherIsBetter={false} />
            <Delta label="blunders" now={r.momentCounts?.blunder} before={p?.momentCounts?.blunder} higherIsBetter={false} />
          </div>
        </section>
      )}

      {a?.training_plan && (
        <section className="bg-ink text-paper rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Target size={16} />
            <p className="font-mono text-xs uppercase tracking-widest opacity-70">Next meeting</p>
          </div>
          <p className="text-sm">{a.training_plan.next_meeting_focus}</p>
          {a.training_plan.measurable_challenge && (
            <p className="text-sm opacity-80 pt-2 border-t border-paper/20">
              Challenge: {a.training_plan.measurable_challenge}
            </p>
          )}
          {a.training_plan.review_these?.length > 0 && (
            <div className="pt-2 border-t border-paper/20">
              <p className="font-mono text-[10px] uppercase tracking-widest opacity-70 mb-1.5">Review these</p>
              <div className="space-y-1">
                {a.training_plan.review_these.map((rv: any, i: number) => (
                  <Link key={i} href={`/dashboard/meetings/${rv.meeting_id}`}
                    className="flex items-start gap-1.5 text-xs opacity-90 hover:opacity-100">
                    <Play size={10} className="flex-shrink-0 mt-0.5" />
                    <span className="font-mono">{rv.timestamp}</span>
                    <span>— {rv.why}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {a?.priorities?.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-warn" />
            <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Development priorities</p>
          </div>
          <div className="space-y-3">
            {a.priorities.map((pr: any, i: number) => {
              const TI = TREND_ICON[pr.trend] ?? Info;
              return (
                <div key={i} className="bg-surface border border-border rounded-xl p-5 card-shadow">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-base text-ink font-medium">{pr.title}</p>
                    <span className={`flex items-center gap-1 font-mono text-[10px] flex-shrink-0 ${TREND_CLS[pr.trend]}`}>
                      <TI size={10} /> {pr.trend?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-brass uppercase tracking-widest mb-2">{pr.occurrences}</p>
                  <p className="text-sm text-ink-muted mb-2">{pr.pattern}</p>
                  <p className="text-sm text-ink mb-3"><span className="text-ink-muted">Why it matters: </span>{pr.why_it_matters}</p>

                  {pr.evidence?.length > 0 && (
                    <div className="bg-paper border border-border rounded-lg p-3 mb-3 space-y-1.5">
                      {pr.evidence.map((e: any, j: number) => (
                        <Link key={j} href={`/dashboard/meetings/${e.meeting_id}`}
                          className="flex items-start gap-2 text-xs hover:opacity-70 transition">
                          <Play size={10} className="text-teal flex-shrink-0 mt-0.5" />
                          <span className="font-mono text-teal">{e.timestamp}</span>
                          <span className="text-ink-muted">{e.client} · {e.date}</span>
                          <span className="text-ink flex-1">{e.what_happened}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {pr.client_response && (
                    <p className="text-xs text-ink-muted mb-2">Client response: {pr.client_response}</p>
                  )}

                  <div className="bg-good-soft border border-good/20 rounded-lg p-3">
                    <p className="text-xs text-ink mb-1.5">{pr.do_differently}</p>
                    {pr.better_language && (
                      <p className="text-sm text-ink italic">"{pr.better_language}"</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {a?.strengths?.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Award size={15} className="text-good" />
            <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Strengths</p>
          </div>
          <div className="space-y-3">
            {a.strengths.map((s: any, i: number) => {
              const TI = TREND_ICON[s.trend] ?? Info;
              return (
                <div key={i} className="bg-good-soft border border-good/20 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-base text-ink font-medium">{s.title}</p>
                    <span className={`flex items-center gap-1 font-mono text-[10px] flex-shrink-0 ${TREND_CLS[s.trend]}`}>
                      <TI size={10} /> {s.trend?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-good uppercase tracking-widest mb-2">{s.occurrences}</p>
                  <p className="text-sm text-ink mb-2">{s.impact}</p>
                  <p className="text-sm text-ink-muted mb-3">{s.why_it_works}</p>
                  {s.evidence?.length > 0 && (
                    <div className="bg-surface border border-border rounded-lg p-3 space-y-1.5">
                      {s.evidence.map((e: any, j: number) => (
                        <Link key={j} href={`/dashboard/meetings/${e.meeting_id}`}
                          className="flex items-start gap-2 text-xs hover:opacity-70 transition">
                          <Play size={10} className="text-teal flex-shrink-0 mt-0.5" />
                          <span className="font-mono text-teal">{e.timestamp}</span>
                          <span className="text-ink-muted">{e.client} · {e.date}</span>
                          <span className="text-ink flex-1">{e.what_happened}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
