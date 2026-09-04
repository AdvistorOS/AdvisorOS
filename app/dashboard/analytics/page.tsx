"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { TrendingUp, TrendingDown, Minus, Target, Users, Gauge, Swords, Heart, AlertTriangle, Snowflake } from "lucide-react";
import { LoadingDots } from "../LoadingDots";
import { OverallInsights } from "./OverallInsights";

const SKILL_KEYS = ["discovery", "question_quality", "listening", "objection_handling", "commercial_positioning", "client_engagement", "next_step_clarity", "talk_ratio", "rapport"];

function getScore(v: any): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && typeof v.score === "number") return v.score;
  return null;
}

function Metric({ label, now, before, higherIsBetter = true, suffix = "" }: {
  label: string; now: number | null; before?: number | null; higherIsBetter?: boolean; suffix?: string;
}) {
  if (now === null) return null;
  const diff = before !== null && before !== undefined ? Math.round((now - before) * 10) / 10 : null;
  const good = diff === null || diff === 0 ? null : higherIsBetter ? diff > 0 : diff < 0;
  const Icon = diff === null || diff === 0 ? Minus : good ? TrendingUp : TrendingDown;
  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
      <p className="text-xs text-ink-muted capitalize">{label.replace(/_/g, " ")}</p>
      <div className="flex items-baseline gap-2">
        <p className="font-display text-xl text-ink">{now}{suffix}</p>
        {diff !== null && diff !== 0 && (
          <span className={`flex items-center gap-0.5 font-mono text-xs ${good ? "text-good" : "text-warn"}`}>
            <Icon size={10} />{Math.abs(diff)}
          </span>
        )}
      </div>
      {before !== null && before !== undefined && (
        <p className="font-mono text-[10px] text-ink-muted">prev {before}{suffix}</p>
      )}
    </div>
  );
}

export default function OverallAnalyticsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [perf, setPerf] = useState<any>(null);
  const [health, setHealth] = useState<any[]>([]);
  const [skillData, setSkillData] = useState<any[]>([]);
  const [scoreTrend, setScoreTrend] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: meetings } = await supabase
        .from("meetings").select("id, created_at, client_id, clients(full_name)")
        .eq("adviser_id", user.id).eq("status", "done").order("created_at", { ascending: false });

      if (!meetings?.length) { setLoading(false); return; }
      const ids = meetings.map((m) => m.id);

      const [{ data: factsRows }, { data: momentRows }, { data: clients }, { data: intel }] = await Promise.all([
        supabase.from("extracted_facts").select("meeting_id, payload").in("meeting_id", ids),
        supabase.from("meeting_moments").select("meeting_id, payload").in("meeting_id", ids),
        supabase.from("clients").select("id, full_name, risk_note").eq("adviser_id", user.id),
        supabase.from("intelligence_objects").select("client_id, temporal_status")
          .in("meeting_id", ids).neq("validation_status", "rejected"),
      ]);

      const factsBy: Record<string, any> = {};
      for (const f of factsRows ?? []) factsBy[f.meeting_id] = f.payload;
      const momentsBy: Record<string, any> = {};
      for (const m of momentRows ?? []) momentsBy[m.meeting_id] = m.payload;

      const half = Math.floor(meetings.length / 2);
      const recent = meetings.slice(0, half || 1);
      const previous = half ? meetings.slice(half) : [];

      function period(list: any[]) {
        const skills: Record<string, number[]> = {};
        let achieved = 0, assessed = 0;
        const mc: Record<string, number> = { brilliant: 0, good: 0, missed: 0, mistake: 0, blunder: 0 };
        for (const m of list) {
          const f = factsBy[m.id];
          if (f?.scorecard) {
            for (const k of SKILL_KEYS) {
              const s = getScore(f.scorecard[k]);
              if (s !== null) (skills[k] ??= []).push(s);
            }
          }
          const a = f?.objective_assessment?.achieved;
          if (a === "yes") { achieved++; assessed++; }
          else if (a === "partially" || a === "no") assessed++;
          for (const x of momentsBy[m.id]?.moments ?? []) {
            if (mc[x.classification] !== undefined) mc[x.classification]++;
          }
        }
        const avgs: Record<string, number> = {};
        for (const [k, arr] of Object.entries(skills)) {
          avgs[k] = Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
        }
        return { avgs, achieved, assessed, mc, count: list.length };
      }

      const r = period(recent);
      const p = previous.length ? period(previous) : null;
      setPerf({ recent: r, previous: p, total: meetings.length });

      setSkillData(SKILL_KEYS.filter((k) => r.avgs[k] !== undefined).map((k) => ({
        skill: k.replace(/_/g, " "), value: r.avgs[k],
      })));

      const chron = [...meetings].reverse();
      setScoreTrend(chron.map((m: any, i: number) => ({
        label: `M${i + 1}`,
        date: new Date(m.created_at).toLocaleDateString(),
        score: getScore(factsBy[m.id]?.scorecard?.overall),
      })).filter((x) => x.score !== null));

      // Relationship health — deliberately NOT ranked by meeting score
      const lastSeen: Record<string, string> = {};
      const meetingCount: Record<string, number> = {};
      const sentiments: Record<string, string[]> = {};
      for (const m of meetings) {
        if (!lastSeen[m.client_id]) lastSeen[m.client_id] = m.created_at;
        meetingCount[m.client_id] = (meetingCount[m.client_id] ?? 0) + 1;
        const s = factsBy[m.id]?.client_sentiment?.overall_satisfaction;
        if (s) (sentiments[m.client_id] ??= []).push(s);
      }
      const unresolvedByClient: Record<string, number> = {};
      for (const i of intel ?? []) {
        if (["unresolved", "escalating", "contradicted"].includes(i.temporal_status)) {
          unresolvedByClient[i.client_id] = (unresolvedByClient[i.client_id] ?? 0) + 1;
        }
      }

      setHealth((clients ?? []).map((c: any) => {
        const days = lastSeen[c.id] ? Math.floor((Date.now() - new Date(lastSeen[c.id]).getTime()) / 86400000) : null;
        const sent = sentiments[c.id] ?? [];
        const latestSentiment = sent[0] ?? null;
        return {
          id: c.id, name: c.full_name,
          meetings: meetingCount[c.id] ?? 0,
          daysSince: days,
          sentiment: latestSentiment,
          unresolved: unresolvedByClient[c.id] ?? 0,
          hasRisk: !!c.risk_note,
        };
      }).sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999)));

      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <main className="max-w-3xl mx-auto px-8"><LoadingDots label="Loading…" /></main>;

  if (!perf) {
    return (
      <main className="max-w-3xl mx-auto px-8 py-10">
        <h1 className="font-display text-3xl text-ink mb-8">Overall Stats</h1>
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <Gauge size={22} className="text-ink-muted mx-auto mb-3" />
          <p className="text-sm text-ink-muted">No completed meetings yet.</p>
        </div>
      </main>
    );
  }

  const r = perf.recent, p = perf.previous;
  const objRate = r.assessed ? Math.round((r.achieved / r.assessed) * 100) : null;
  const prevObjRate = p?.assessed ? Math.round((p.achieved / p.assessed) * 100) : null;

  return (
    <main className="max-w-3xl mx-auto px-8 py-10 space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink mb-1">Overall Stats</h1>
        <p className="text-ink-muted text-sm">
          {perf.total} meetings · last {r.count} compared against previous {p?.count ?? 0}
        </p>
      </div>

      <OverallInsights />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-teal" />
          <p className="font-mono text-xs text-teal uppercase tracking-widest">Your performance</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Metric label="objectives met" now={objRate} before={prevObjRate} suffix="%" />
          <Metric label="brilliant moves" now={r.mc.brilliant} before={p?.mc.brilliant} />
          <Metric label="mistakes" now={r.mc.mistake} before={p?.mc.mistake} higherIsBetter={false} />
          <Metric label="blunders" now={r.mc.blunder} before={p?.mc.blunder} higherIsBetter={false} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {SKILL_KEYS.filter((k) => r.avgs[k] !== undefined).map((k) => (
            <Metric key={k} label={k} now={r.avgs[k]} before={p?.avgs?.[k] ?? null} suffix="/10" />
          ))}
        </div>

        {skillData.length >= 3 && (
          <div className="bg-surface border border-border rounded-xl p-5 card-shadow">
            <p className="text-xs text-ink-muted mb-3">Skill profile — recent period</p>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={skillData}>
                <PolarGrid stroke="#E3E0D2" />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: "#56675F" }} />
                <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 9, fill: "#56675F" }} />
                <Radar dataKey="value" stroke="#0B5C52" fill="#0B5C52" fillOpacity={0.25} strokeWidth={2} />
                <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E3E0D2", borderRadius: 8, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {scoreTrend.length >= 2 && (
          <div className="bg-surface border border-border rounded-xl p-5 card-shadow">
            <p className="text-xs text-ink-muted mb-3">Meeting execution over time</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={scoreTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D2" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#56675F" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#56675F" }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E3E0D2", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(l) => scoreTrend.find((d) => d.label === l)?.date ?? l} />
                <Line type="monotone" dataKey="score" stroke="#0B5C52" strokeWidth={2} dot={{ r: 3, fill: "#0B5C52" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Heart size={16} className="text-brass" />
          <p className="font-mono text-xs text-brass uppercase tracking-widest">Client relationship health</p>
        </div>
        <p className="text-xs text-ink-muted">
          Not a ranking. Sorted by time since last contact — a client with a lower meeting score is not a worse client.
        </p>
        <div className="space-y-2">
          {health.map((c) => (
            <Link key={c.id} href={`/dashboard/clients/${c.id}`}
              className="flex items-center justify-between gap-3 bg-surface border border-border rounded-lg px-4 py-3 card-shadow hover:border-teal/40 transition">
              <div className="min-w-0">
                <p className="text-sm text-ink font-medium truncate">{c.name}</p>
                <p className="text-xs text-ink-muted">
                  {c.meetings} meeting{c.meetings !== 1 ? "s" : ""}
                  {c.sentiment && ` · last sentiment ${c.sentiment}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {c.unresolved > 0 && (
                  <span className="font-mono text-[10px] text-brass bg-brass-soft px-1.5 py-0.5 rounded-full">
                    {c.unresolved} open
                  </span>
                )}
                {c.hasRisk && <AlertTriangle size={12} className="text-warn" />}
                {c.daysSince !== null && (
                  <span className={`flex items-center gap-1 font-mono text-xs ${c.daysSince > 21 ? "text-warn" : "text-ink-muted"}`}>
                    {c.daysSince > 21 && <Snowflake size={10} />}
                    {c.daysSince}d
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
