"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import { TrendingUp, Target, Users, Gauge } from "lucide-react";
import { LoadingDots } from "../LoadingDots";
import { OverallInsights } from "./OverallInsights";

const SENTIMENT_VALUE: Record<string, number> = { unhappy: 0, neutral: 1, positive: 2 };
const SENTIMENT_COLOR = ["#B85630", "#C9971E", "#2E7D5E"];

export default function OverallAnalyticsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [equityData, setEquityData] = useState<any[]>([]);
  const [sentimentData, setSentimentData] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalMeetings: 0, totalClients: 0, achieved: 0, totalAssessed: 0, avgScore: 0 });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: meetings } = await supabase
        .from("meetings").select("id, created_at, client_id")
        .eq("adviser_id", user.id).eq("status", "done").order("created_at");

      const { data: clients } = await supabase.from("clients").select("id").eq("adviser_id", user.id);

      if (!meetings?.length) { setLoading(false); return; }

      const { data: factsRows } = await supabase
        .from("extracted_facts").select("meeting_id, payload").in("meeting_id", meetings.map((m) => m.id));
      const factsBy: Record<string, any> = {};
      for (const f of factsRows ?? []) factsBy[f.meeting_id] = f.payload;

      let achieved = 0, totalAssessed = 0, scoreSum = 0, scoreCount = 0;
      let cumulativeScore = 0;

      const equity = meetings.map((m: any, i: number) => {
        const f = factsBy[m.id] ?? {};
        const score = f.scorecard?.overall;
        const a = f.objective_assessment?.achieved;
        if (a === "yes") { achieved++; totalAssessed++; }
        else if (a === "partially" || a === "no") totalAssessed++;
        if (typeof score === "number") {
          scoreSum += score; scoreCount++;
          // Equity-curve style: net movement relative to a neutral baseline of 5/10
          cumulativeScore += (score - 5);
        }
        return { label: `M${i + 1}`, date: new Date(m.created_at).toLocaleDateString(), cumulative: cumulativeScore };
      });

      const sentiment = meetings.map((m: any, i: number) => {
        const f = factsBy[m.id] ?? {};
        const s = f.client_sentiment?.overall_satisfaction;
        return { label: `M${i + 1}`, date: new Date(m.created_at).toLocaleDateString(), value: s ? SENTIMENT_VALUE[s] ?? 1 : null, sentimentLabel: s ?? "n/a" };
      });

      setEquityData(equity);
      setSentimentData(sentiment.filter((s) => s.value !== null));
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
