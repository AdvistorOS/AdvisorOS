import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Calendar, AlertCircle, CheckSquare, Users, Clock3 } from "lucide-react";

const REQUIRED_CATEGORIES = ["income", "objectives", "attitude_to_risk"];

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const firstName = user?.email?.split("@")[0] ?? "there";

  const { data: meetings } = await supabase
    .from("meetings").select("*, clients(id, full_name)").order("created_at", { ascending: false });
  const { data: extracted } = await supabase
    .from("extracted_facts").select("*, meetings!inner(id, adviser_id, clients(full_name))").eq("reviewed", false);
  const { data: openActions } = await supabase.from("actions").select("*, clients(full_name)").eq("status", "open");
  const { data: clientFacts } = await supabase.from("client_facts").select("client_id, category").is("superseded_by", null);
  const { data: clients } = await supabase.from("clients").select("id, full_name");

  const todayStr = new Date().toDateString();
  const todaysMeetings = (meetings ?? []).filter((m) => new Date(m.created_at).toDateString() === todayStr);

  const missingCount = (clients ?? []).filter((c) => {
    const have = new Set((clientFacts ?? []).filter((f) => f.client_id === c.id).map((f) => f.category));
    return REQUIRED_CATEGORIES.some((cat) => !have.has(cat));
  }).length;

  const attentionItems: { title: string; client: string }[] = [];
  for (const ef of extracted ?? []) {
    for (const item of ef.payload?.attention_items ?? []) {
      attentionItems.push({ title: item.title, client: (ef as any).meetings?.clients?.full_name ?? "Unknown" });
    }
  }

  const stats = [
    { label: "Meetings today", value: todaysMeetings.length, icon: Calendar },
    { label: "Awaiting review", value: extracted?.length ?? 0, icon: AlertCircle },
    { label: "Outstanding tasks", value: openActions?.length ?? 0, icon: CheckSquare },
    { label: "Clients needing info", value: missingCount, icon: Users },
  ];

  return (
    <main className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="font-display text-3xl text-ink mb-1">Good morning, {firstName}</h1>
      <p className="text-ink-muted text-sm mb-8">Here's what needs your attention today.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-5 card-shadow">
            <s.icon size={16} className="text-teal mb-3" />
            <p className="font-display text-2xl text-ink">{s.value}</p>
            <p className="text-xs text-ink-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Today's meetings</p>
          {todaysMeetings.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing scheduled today.</p>
          ) : (
            <div className="space-y-2">
              {todaysMeetings.map((m: any) => (
                <Link key={m.id} href={`/dashboard/meetings/${m.id}`}
                  className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3 card-shadow card-shadow-hover transition">
                  <span className="text-sm text-ink">{m.clients?.full_name}</span>
                  <span className="font-mono text-xs text-ink-muted">{m.status}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">AI attention required</p>
          {attentionItems.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing flagged.</p>
          ) : (
            <div className="space-y-2">
              {attentionItems.slice(0, 6).map((item, i) => (
                <div key={i} className="bg-warn-soft border border-warn/20 rounded-lg px-4 py-3">
                  <p className="text-sm text-ink">{item.title}</p>
                  <p className="text-xs text-ink-muted">{item.client}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-10">
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Recent activity</p>
        <div className="space-y-2">
          {(meetings ?? []).slice(0, 6).map((m: any) => (
            <Link key={m.id} href={`/dashboard/meetings/${m.id}`}
              className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3 card-shadow card-shadow-hover transition">
              <div>
                <p className="text-sm text-ink">{m.clients?.full_name}</p>
                <p className="font-mono text-xs text-ink-muted flex items-center gap-1.5 mt-0.5">
                  <Clock3 size={11} /> {new Date(m.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="font-mono text-xs text-ink-muted">{m.status}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
