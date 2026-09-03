"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { TrendingUp, Target, Users, Gauge, Swords, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { LoadingDots } from "../LoadingDots";
import { OverallInsights } from "./OverallInsights";

const SENTIMENT_VALUE: Record<string, number> = { unhappy: 0, neutral: 1, positive: 2 };
const SENTIMENT_COLOR = ["#B85630", "#C9971E", "#2E7D5E"];
const SKILL_KEYS = ["discovery", "question_quality", "listening", "objection_handling", "commercial_positioning", "client_engagement", "next_step_clarity"];

function getScore(val: any): number | null {
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && typeof val.score === "number") return val.score;
  return null;
}

export default function OverallAnalyticsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [equityData, setEquityData] = useState<any[]>([]);
  const [sentimentData, setSentimentData] = useState<any[]>([]);
  const [skillData, setSkillData] = useState<any[]>([]);
  const [clientLeaderboard, setClientLeaderboard] = useState<any[]>([]);
  const [momentCounts, setMomentCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ totalMeetings: 0, totalClients: 0, achieved: 0, totalAssessed: 0, avgScore: 0 });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: meetings } = await supabase
        .from("meetings").select("id, created_at, client_id, clients(full_name)")
        .eq("adviser_id", user.id).eq("status", "done").order("created_at");

      const { data: clients } = await supabase.from("clients").select("id").eq("adviser_id", user.id);

      if (!meetings?.length) { setLoading(false); return; }

      const { data: factsRows } = await supabase
        .from("extracted_facts").select("meeting_id, payload").in("meeting_id", meetings.map((m) => m.id));
      const factsBy: Record<string, any> = {};
      for (const f of factsRows ?? []) factsBy[f.meeting_id] = f.payload;

      const { data: momentRows } = await supabase
        .from("meeting_moments").select("payload").in("meeting_id", meetings.map((m) => m.id));

      let achieved = 0, totalAssessed = 0, scoreSum = 0, scoreCount = 0;
      let cumulativeScore = 0;
      const skillSums: Record<string, { sum: number; count: number }> = {};
      const perClient: Record<string, { name: string; scores: number[] }> = {};

      const equity = meetings.map((m: any, i: number) => {
        const f = factsBy[m.id] ?? {};
        const score = getScore(f.scorecard?.overall);
        const a = f.objective_assessment?.achieved;
        if (a === "yes") { achieved++; totalAssessed++; }
        else if (a === "partially" || a === "no") totalAssessed++;
        if (score !== null) {
          scoreSum += score; scoreCount++;
          cumulativeScore += (score - 5);

          const cName = (m.clients as any)?.full_name ?? "Unknown";
          if (!perClient[m.client_id]) perClient[m.client_id] = { name: cName, scores: [] };
          perClient[m.client_id].scores.push(score);
        }
        for (const key of SKILL_KEYS) {
          const s = getScore(f.scorecard?.[key]);
          if (s === null) continue;
          if (!skillSums[key]) skillSums[key] = { sum: 0, count: 0 };
          skillSums[key].sum += s; skillSums[key].count++;
        }
        return { label: `M${i + 1}`, date: new Date(m.created_at).toLocaleDateString(), cumulative: cumulativeScore };
      });

      const sentiment = meetings.map((m: any, i: number) => {
        const f = factsBy[m.id] ?? {};
        const s = f.client_sentiment?.overall_satisfaction;
        return { label: `M${i + 1}`, date: new Date(m.created_at).toLocaleDateString(), value: s ? SENTIMENT_VALUE[s] ?? 1 : null, sentimentLabel: s ?? "n/a" };
      });

      const skills = SKILL_KEYS.filter((k) => skillSums[k]?.count).map((k) => ({
        skill: k.replace(/_/g, " "),
        value: Math.round((skillSums[k].sum / skillSums[k].count) * 10) / 10,
      }));

      const leaderboard = Object.entries(perClient)
        .map(([clientId, data]) => {
          const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
          const trend = data.scores.length >= 2 ? data.scores[data.scores.length - 1] - data.scores[0] : 0;
          return { clientId, name: data.name, avg: Math.round(avg * 10) / 10, meetings: data.scores.length, trend };
        })
        .sort((a, b) => b.avg - a.avg);

      const moments: Record<string, number> = { brilliant: 0, good: 0, missed: 0, mistake: 0, blunder: 0 };
      for (const row of momentRows ?? []) {
        for (const m of (row.payload as any)?.moments ?? []) {
          if (moments[m.classification] !== undefined) moments[m.classification]++;
        }
      }

      setEquityData(equity);
      setSentimentData(sentiment.filter((s) => s.value !== null));
      setSkillData(skills);
      setClientLeaderboard(leaderboard);
      setMomentCounts(moments);
      setStats({
        totalMeetings: meetings.length,
        totalClients: clients?.length ?? 0,
        achieved, totalAssessed,
        avgScore: scoreCount ? Math.round((scoreSum / scoreCount) * 10) / 10 : 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <main className="max-w-3xl mx-auto px-8"><LoadingDots label="Loading analytics…" /></main>;

  if (!equityData.length) {
    return (
      <main className="max-w-3xl mx-auto px-8 py-10">
        <h1 className="font-display text-3xl text-ink mb-8">Overall Stats</h1>
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <TrendingUp size={22} className="text-ink-muted mx-auto mb-3" />
          <p className="text-sm text-ink-muted">No completed meetings yet — this fills in as you record and process them.</p>
        </div>
      </main>
    );
  }

  const totalMoments = Object.values(momentCounts).reduce((a, b) => a + b, 0);

  return (
    <main className="max-w-3xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink mb-1">Overall Stats</h1>
        <p className="text-ink-muted text-sm">Every meeting, every client, combined.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
          <p className="text-xs text-ink-muted flex items-center gap-1.5"><Users size={11} /> Clients</p>
          <p className="font-display text-2xl text-ink">{stats.totalClients}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
          <p className="text-xs text-ink-muted flex items-center gap-1.5"><Gauge size={11} /> Meetings</p>
          <p className="font-display text-2xl text-ink">{stats.totalMeetings}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
          <p className="text-xs text-ink-muted flex items-center gap-1.5"><Target size={11} /> Objectives met</p>
          <p className="font-display text-2xl text-ink">{stats.achieved}<span className="text-sm text-ink-muted">/{stats.totalAssessed}</span></p>
        </div>
        <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
          <p className="text-xs text-ink-muted flex items-center gap-1.5"><TrendingUp size={11} /> Avg score</p>
          <p className="font-display text-2xl text-ink">{stats.avgScore}<span className="text-sm text-ink-muted">/10</span></p>
        </div>
      </div>

      <OverallInsights />

      {skillData.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 card-shadow">
          <p className="text-xs text-ink-muted mb-3">Skill breakdown — average across all meetings</p>
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

      {clientLeaderboard.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 card-shadow">
          <p className="text-xs text-ink-muted mb-3">Client leaderboard — by average meeting score</p>
          <div className="space-y-1.5">
            {clientLeaderboard.map((c, i) => (
              <Link key={c.clientId} href={`/dashboard/clients/${c.clientId}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-teal-soft/40 transition">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-ink-muted w-4">{i + 1}</span>
                  <span className="text-sm text-ink font-medium">{c.name}</span>
                  <span className="text-xs text-ink-muted">{c.meetings} meeting{c.meetings !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  {c.trend > 0 && <ArrowUp size={12} className="text-good" />}
                  {c.trend < 0 && <ArrowDown size={12} className="text-warn" />}
                  {c.trend === 0 && <Minus size={12} className="text-ink-muted" />}
                  <span className="font-display text-base text-ink">{c.avg}<span className="text-xs text-ink-muted">/10</span></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {totalMoments > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 card-shadow">
          <div className="flex items-center gap-2 mb-3">
            <Swords size={14} className="text-teal" />
            <p className="text-xs text-ink-muted">Key moments across all analysed meetings</p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[
              { key: "brilliant", label: "Brilliant", color: "text-good" },
              { key: "good", label: "Good", color: "text-teal" },
              { key: "missed", label: "Missed", color: "text-brass" },
              { key: "mistake", label: "Mistake", color: "text-warn" },
              { key: "blunder", label: "Blunder", color: "text-warn" },
            ].map((m) => (
              <div key={m.key} className="text-center">
                <p className={`font-display text-2xl ${m.color}`}>{momentCounts[m.key] ?? 0}</p>
                <p className="text-[10px] text-ink-muted">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-5 card-shadow">
        <p className="text-xs text-ink-muted mb-1">Performance curve</p>
        <p className="text-[11px] text-ink-muted mb-3">Cumulative movement above/below a neutral 5/10 baseline, meeting by meeting, across all clients.</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={equityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D2" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#56675F" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#56675F" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ background: "#FFFFFF", border: "1px solid #E3E0D2", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(label) => equityData.find((d) => d.label === label)?.date ?? label}
            />
            <Line type="monotone" dataKey="cumulative" stroke="#0B5C52" strokeWidth={2} dot={{ r: 2, fill: "#0B5C52" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {sentimentData.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 card-shadow">
          <p className="text-xs text-ink-muted mb-3">Sentiment across all meetings</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={sentimentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D2" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#56675F" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 2]} ticks={[0, 1, 2]} tickFormatter={(v) => ["Unhappy", "Neutral", "Positive"][v]}
                tick={{ fontSize: 10, fill: "#56675F" }} axisLine={false} tickLine={false} width={52} />
              <Tooltip
                contentStyle={{ background: "#FFFFFF", border: "1px solid #E3E0D2", borderRadius: 8, fontSize: 12 }}
                formatter={(_v: any, _n: any, props: any) => [props.payload.sentimentLabel, "Sentiment"]}
                labelFormatter={(label) => sentimentData.find((d) => d.label === label)?.date ?? label}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {sentimentData.map((d, i) => <Cell key={i} fill={SENTIMENT_COLOR[d.value]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </main>
  );
}
