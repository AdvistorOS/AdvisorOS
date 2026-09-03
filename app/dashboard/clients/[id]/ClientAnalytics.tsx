"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import { BarChart3 } from "lucide-react";

const SENTIMENT_VALUE: Record<string, number> = { unhappy: 0, neutral: 1, positive: 2 };
const SENTIMENT_COLOR = ["#B85630", "#C9971E", "#2E7D5E"];

export function ClientAnalytics({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [data, setData] = useState<any[] | null>(null);
  const [objectiveStats, setObjectiveStats] = useState<{ achieved: number; partial: number; missed: number; total: number } | null>(null);

  useEffect(() => {
    async function load() {
      const { data: meetings } = await supabase
        .from("meetings").select("id, created_at, objective")
        .eq("client_id", clientId).eq("status", "done").order("created_at");
      if (!meetings?.length) { setData([]); return; }

      const { data: factsRows } = await supabase
        .from("extracted_facts").select("meeting_id, payload").in("meeting_id", meetings.map((m) => m.id));
      const factsBy: Record<string, any> = {};
      for (const f of factsRows ?? []) factsBy[f.meeting_id] = f.payload;

      let achieved = 0, partial = 0, missed = 0, total = 0;
      const points = meetings.map((m: any, i: number) => {
        const f = factsBy[m.id] ?? {};
        const sentiment = f.client_sentiment?.overall_satisfaction;
        const score = f.scorecard?.overall;
        const a = f.objective_assessment?.achieved;
        if (a === "yes") { achieved++; total++; }
        else if (a === "partially") { partial++; total++; }
        else if (a === "no") { missed++; total++; }
        return {
          label: `M${i + 1}`,
          date: new Date(m.created_at).toLocaleDateString(),
          sentiment: sentiment ? SENTIMENT_VALUE[sentiment] ?? 1 : null,
          sentimentLabel: sentiment ?? "n/a",
          score: typeof score === "number" ? score : null,
        };
      });

      setData(points);
      setObjectiveStats({ achieved, partial, missed, total });
    }
    load();
  }, [clientId]);

  if (data === null) return null;
  if (data.length < 2) return null;

  const hasScores = data.some((d) => d.score !== null);
  const hasSentiment = data.some((d) => d.sentiment !== null);

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={15} className="text-teal" />
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Analytics</p>
      </div>

      {objectiveStats && objectiveStats.total > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 card-shadow mb-3">
          <p className="text-xs text-ink-muted mb-3">Objective achievement</p>
          <div className="flex items-center gap-4">
            <div className="flex h-3 flex-1 rounded-full overflow-hidden bg-border">
              {objectiveStats.achieved > 0 && <div className="bg-good" style={{ width: `${(objectiveStats.achieved / objectiveStats.total) * 100}%` }} />}
              {objectiveStats.partial > 0 && <div className="bg-brass" style={{ width: `${(objectiveStats.partial / objectiveStats.total) * 100}%` }} />}
              {objectiveStats.missed > 0 && <div className="bg-warn" style={{ width: `${(objectiveStats.missed / objectiveStats.total) * 100}%` }} />}
            </div>
            <p className="font-mono text-xs text-ink-muted whitespace-nowrap">{objectiveStats.achieved}/{objectiveStats.total} met</p>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-ink-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-good" /> Achieved</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brass" /> Partial</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warn" /> Missed</span>
          </div>
        </div>
      )}

      {hasScores && (
        <div className="bg-surface border border-border rounded-xl p-5 card-shadow mb-3">
          <p className="text-xs text-ink-muted mb-3">Meeting score trend</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D2" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#56675F" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#56675F" }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{ background: "#FFFFFF", border: "1px solid #E3E0D2", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(label) => data.find((d) => d.label === label)?.date ?? label}
              />
              <Line type="monotone" dataKey="score" stroke="#0B5C52" strokeWidth={2} dot={{ r: 3, fill: "#0B5C52" }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasSentiment && (
        <div className="bg-surface border border-border rounded-xl p-5 card-shadow">
          <p className="text-xs text-ink-muted mb-3">Client satisfaction trend</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D2" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#56675F" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 2]} ticks={[0, 1, 2]} tickFormatter={(v) => ["Unhappy", "Neutral", "Positive"][v]}
                tick={{ fontSize: 10, fill: "#56675F" }} axisLine={false} tickLine={false} width={52} />
              <Tooltip
                contentStyle={{ background: "#FFFFFF", border: "1px solid #E3E0D2", borderRadius: 8, fontSize: 12 }}
                formatter={(_value: any, _name: any, props: any) => [props.payload.sentimentLabel, "Sentiment"]}
                labelFormatter={(label) => data.find((d) => d.label === label)?.date ?? label}
              />
              <Bar dataKey="sentiment" radius={[4, 4, 0, 0]}>
                {data.map((d, i) => <Cell key={i} fill={d.sentiment !== null ? SENTIMENT_COLOR[d.sentiment] : "#E3E0D2"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
