import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: meetings } = await supabase
    .from("meetings")
    .select("*, clients(full_name), internal_notes(payload)")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border px-8 py-5 flex items-center justify-between">
        <span className="font-display text-xl text-ink">AdvisorOS</span>
        <Link href="/dashboard/upload"
          className="bg-ink text-paper text-sm px-4 py-2 rounded-sm hover:opacity-90 transition">
          + New meeting
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display text-2xl text-ink mb-8">Recent meetings</h1>

        {!meetings?.length && (
          <p className="text-ink-muted text-sm">No meetings yet. Upload your first recording to get started.</p>
        )}

        <div className="divide-y divide-border border-t border-b border-border">
          {meetings?.map((m: any) => {
            const sentiment = m.internal_notes?.[0]?.payload?.overall_satisfaction;
            return (
              <Link key={m.id} href={`/dashboard/meetings/${m.id}`}
                className="flex items-center justify-between py-4 pl-3 border-l-2 border-transparent hover:border-brass transition group">
                <div>
                  <p className="text-ink group-hover:text-brass transition">{m.clients?.full_name}</p>
                  <p className="font-mono text-xs text-ink-muted mt-1">
                    {new Date(m.created_at).toLocaleDateString()} &middot; {m.status}
                  </p>
                </div>
                {sentiment && (
                  <span className={`font-mono text-xs px-2 py-1 rounded-sm
                    ${sentiment === "positive" ? "text-good" : sentiment === "unhappy" ? "text-warn" : "text-ink-muted"}`}>
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
