import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Clock3, User, UserPlus } from "lucide-react";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: meetings } = await supabase
    .from("meetings")
    .select("*, clients(id, full_name), internal_notes(payload)")
    .order("created_at", { ascending: false });

  const grouped: Record<string, { name: string; meetings: any[] }> = {};
  for (const m of meetings ?? []) {
    const clientId = m.clients?.id ?? "unknown";
    const clientName = m.clients?.full_name ?? "Unknown client";
    if (!grouped[clientId]) grouped[clientId] = { name: clientName, meetings: [] };
    grouped[clientId].meetings.push(m);
  }
  const groups = Object.entries(grouped).sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border bg-surface/60 backdrop-blur-sm sticky top-0 z-10 px-8 py-5 flex items-center justify-between">
        <div>
          <span className="font-display text-xl text-ink tracking-tight">AdvisorOS</span>
          <p className="text-ink-muted text-xs mt-0.5">Signed in as {user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/team"
            className="text-ink-muted text-sm px-3 py-2.5 rounded-md hover:bg-border transition flex items-center gap-1.5">
            <UserPlus size={16} />
            Team
          </Link>
          <Link href="/dashboard/upload"
            className="bg-ink text-paper text-sm px-4 py-2.5 rounded-md hover:opacity-90 transition flex items-center gap-2 card-shadow">
            <Plus size={16} strokeWidth={2.5} />
            New meeting
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-ink mb-1">Clients</h1>
        <p className="text-ink-muted text-sm mb-10">Meetings grouped by client.</p>

        {groups.length === 0 && (
          <div className="border border-dashed border-border rounded-lg py-16 text-center">
            <p className="text-ink-muted text-sm mb-4">No meetings yet.</p>
            <Link href="/dashboard/upload" className="text-brass text-sm font-medium hover:underline">
              Upload your first recording →
            </Link>
          </div>
        )}

        <div className="space-y-10">
          {groups.map(([clientId, group]) => (
            <div key={clientId}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-full bg-brass-soft flex items-center justify-center">
                  <User size={13} className="text-brass" strokeWidth={2} />
                </div>
                <h2 className="font-display text-lg text-ink">{group.name}</h2>
                <span className="font-mono text-xs text-ink-muted">({group.meetings.length})</span>
              </div>
              <div className="space-y-2.5">
                {group.meetings.map((m: any) => {
                  const sentiment = m.internal_notes?.[0]?.payload?.overall_satisfaction;
                  const sentimentStyle =
                    sentiment === "positive" ? "bg-good-soft text-good" :
                    sentiment === "unhappy" ? "bg-warn-soft text-warn" :
                    "bg-brass-soft text-ink-muted";
                  return (
                    <Link key={m.id} href={`/dashboard/meetings/${m.id}`}
                      className="flex items-center justify-between bg-surface border border-border rounded-lg px-5 py-3.5 card-shadow card-shadow-hover transition group">
                      <p className="font-mono text-xs text-ink-muted flex items-center gap-1.5">
                        <Clock3 size={11} />
                        {new Date(m.created_at).toLocaleDateString()} · {m.status}
                      </p>
                      {sentiment && (
                        <span className={`font-mono text-xs px-2.5 py-1 rounded-full ${sentimentStyle}`}>
                          {sentiment}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
