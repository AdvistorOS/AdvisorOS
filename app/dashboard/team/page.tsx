"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, AlertTriangle, TrendingUp, ShieldAlert, Loader2 } from "lucide-react";
import { LoadingDots } from "../LoadingDots";

function getScore(v: any): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && typeof v.score === "number") return v.score;
  return null;
}

const SEV: Record<string, string> = {
  high: "bg-warn-soft border-warn/40 text-warn",
  medium: "bg-brass-soft border-brass/30 text-brass",
  low: "bg-surface border-border text-ink-muted",
};

export default function TeamPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [team, setTeam] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [insights, setInsights] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: me } = await supabase
        .from("advisers").select("id, role, firm_id").eq("id", user.id).single();

      if (me?.role !== "manager") { setLoading(false); return; }
      setIsManager(true);

      const { data: members } = await supabase
        .from("advisers").select("id, full_name, email").eq("firm_id", me.firm_id);

      const ids = (members ?? []).map((m) => m.id);

      const { data: meetings } = await supabase
        .from("meetings").select("id, adviser_id, status").in("adviser_id", ids).eq("status", "done");

      const { data: factsRows } = await supabase
        .from("extracted_facts").select("meeting_id, payload")
        .in("meeting_id", (meetings ?? []).map((m) => m.id));

      const factsBy: Record<string, any> = {};
      for (const f of factsRows ?? []) factsBy[f.meeting_id] = f.payload;

      const stats = (members ?? []).map((m) => {
        const theirs = (meetings ?? []).filter((mt) => mt.adviser_id === m.id);
        const scores: number[] = [];
        let achieved = 0, assessed = 0;
        for (const mt of theirs) {
          const f = factsBy[mt.id];
          if (!f) continue;
          const s = getScore(f.scorecard?.overall);
          if (s !== null) scores.push(s);
          const a = f.objective_assessment?.achieved;
          if (a === "yes") { achieved++; assessed++; }
          else if (a === "partially" || a === "no") assessed++;
        }
        return {
          ...m,
          meetings: theirs.length,
          avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
          achieved, assessed,
        };
      }).sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));

      setTeam(stats);

      const { data: flagRows } = await supabase
        .from("language_flags").select("*").in("adviser_id", ids)
        .order("created_at", { ascending: false }).limit(30);

      const nameById: Record<string, string> = {};
      for (const m of members ?? []) nameById[m.id] = m.full_name;
      setFlags((flagRows ?? []).map((f) => ({ ...f, adviserName: nameById[f.adviser_id] ?? "Unknown" })));

      setLoading(false);
    }
    load();
  }, []);

  async function generateInsights() {
    setGenLoading(true);
    const res = await fetch("/api/team-insights", { method: "POST" });
    const data = await res.json();
    setGenLoading(false);
    if (data.insights) setInsights(data.insights);
  }

  if (loading) return <main className="max-w-3xl mx-auto px-8"><LoadingDots label="Loading team…" /></main>;

  if (!isManager) {
    return (
      <main className="max-w-2xl mx-auto px-8 py-10">
        <h1 className="font-display text-3xl text-ink mb-4">Team</h1>
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <Users size={22} className="text-ink-muted mx-auto mb-3" />
          <p className="text-sm text-ink-muted">This page is for team managers. Ask your administrator for access.</p>
        </div>
      </main>
    );
  }

  const highFlags = flags.filter((f) => f.severity === "high").length;

  return (
    <main className="max-w-3xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink mb-1">Team</h1>
        <p className="text-ink-muted text-sm">Performance and compliance across your advisers.</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
          <p className="text-xs text-ink-muted flex items-center gap-1.5"><Users size={11} /> Advisers</p>
          <p className="font-display text-2xl text-ink">{team.length}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
          <p className="text-xs text-ink-muted flex items-center gap-1.5"><TrendingUp size={11} /> Meetings</p>
          <p className="font-display text-2xl text-ink">{team.reduce((s, t) => s + t.meetings, 0)}</p>
        </div>
        <div className={`border rounded-lg px-4 py-3 card-shadow ${highFlags > 0 ? "bg-warn-soft border-warn/30" : "bg-surface border-border"}`}>
          <p className="text-xs text-ink-muted flex items-center gap-1.5"><ShieldAlert size={11} /> High flags</p>
          <p className={`font-display text-2xl ${highFlags > 0 ? "text-warn" : "text-ink"}`}>{highFlags}</p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Coaching insights</p>
          <button onClick={generateInsights} disabled={genLoading}
            className="flex items-center gap-1.5 bg-teal text-paper text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50">
            {genLoading && <Loader2 size={12} className="animate-spin" />}
            {genLoading ? "Analysing…" : insights ? "Refresh" : "Generate"}
          </button>
        </div>
        {insights && (
          <div className="bg-surface border border-border rounded-xl p-5 card-shadow">
            <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{insights}</p>
          </div>
        )}
      </section>

      <section>
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Adviser performance</p>
        <div className="space-y-2">
          {team.map((t) => (
            <div key={t.id} className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow flex items-center justify-between">
              <div>
                <p className="text-sm text-ink font-medium">{t.full_name}</p>
                <p className="text-xs text-ink-muted">
                  {t.meetings} meeting{t.meetings !== 1 ? "s" : ""}
                  {t.assessed > 0 && ` · ${t.achieved}/${t.assessed} objectives met`}
                </p>
              </div>
              {t.avgScore !== null && (
                <p className="font-display text-xl text-ink">{t.avgScore}<span className="text-xs text-ink-muted">/10</span></p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Language flags</p>
        {flags.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl py-10 text-center">
            <p className="text-sm text-ink-muted">No flags raised across the team.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {flags.map((f) => (
              <div key={f.id} className={`border rounded-lg px-4 py-3 ${SEV[f.severity] ?? SEV.low}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle size={12} />
                  <span className="text-xs font-medium">{f.adviserName}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest">{f.category?.replace(/_/g, " ")}</span>
                  {f.timestamp_label && <span className="font-mono text-[10px] ml-auto">{f.timestamp_label}</span>}
                </div>
                {f.quote && <p className="text-sm text-ink italic mb-1">"{f.quote}"</p>}
                <p className="text-xs text-ink-muted">{f.context}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
