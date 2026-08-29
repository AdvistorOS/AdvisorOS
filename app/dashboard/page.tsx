import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Clock3, User, AlertCircle, CheckCircle2 } from "lucide-react";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: meetings } = await supabase
    .from("meetings")
    .select("*, clients(full_name), internal_notes(payload)")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border bg-surface/60 backdrop-blur-sm sticky top-0 z-10 px-8 py-5 flex items-center justify-between">
        <span className="font-display text-xl text-ink tracking-tight">AdvisorOS</span>
        <Link href="/dashboard/upload"
          className="bg-ink text-paper text-sm px-4 py-2.5 rounded-md hover:opacity-90 transition flex items-center gap-2 card-shadow">
          <Plus size={16} strokeWidth={2.5} />
          New meeting
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-ink mb-1">Recent meetings</h1>
        <p className="text-ink-muted text-sm mb-10">Your latest client conversations, transcribed and structured.</p>

        {!meetings?.length && (
          <div className="border border-dashed border-border rounded-lg py-16 text-center">
            <p className="text-ink-muted text-sm mb-4">No meetings yet.</p>
            <Link href="/dashboard/upload" className="text-brass text-sm font-medium hover:underline">
              Upload your first recording →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {meetings?.map((m: any) => {
            const sentiment = m.internal_notes?.[0]?.payload?.overall_satisfaction;
            const sentimentStyle =
              sentiment === "positive" ? "bg-good-soft text-good" :
              sentiment === "unhappy" ? "bg-warn-soft text-warn" :
              "bg-brass-soft text-ink-muted";
            return (
              <Link key={m.id} href={`/dashboard/meetings/${m.id}`}
                className="flex items-center justify-between bg-surface border border-border rounded-lg px-5 py-4 card-shadow card-shadow-hover transition group">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-brass-soft flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-brass" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-ink font-medium group-hover:text-brass transition">{m.clients?.full_name}</p>
                    <p className="font-mono text-xs text-ink-muted mt-0.5 flex items-center gap-1.5">
                      <Clock3 size={11} />
                      {new Date(m.created_at).toLocaleDateString()} · {m.status}
                    </p>
                  </div>
                </div>
                {sentiment && (
                  <span className={`font-mono text-xs px-2.5 py-1 rounded-full ${sentimentStyle}`}>
                    {sentiment}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
