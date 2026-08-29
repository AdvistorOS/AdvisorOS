import { createClient } from "@/lib/supabase/server";
import { FileText } from "lucide-react";

export default async function ClientDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, created_at, client_summary, clients!inner(email)")
    .eq("clients.email", user?.email ?? "")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border px-8 py-5">
        <span className="font-display text-xl text-ink">AdvisorOS</span>
        <p className="text-ink-muted text-xs mt-0.5">Signed in as {user?.email}</p>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="font-display text-2xl text-ink mb-8">Your meeting summaries</h1>

        {!meetings?.length && (
          <p className="text-ink-muted text-sm">No summaries available yet.</p>
        )}

        <div className="space-y-4">
          {meetings?.map((m: any) => (
            <div key={m.id} className="bg-surface border border-border rounded-xl p-6 card-shadow">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} className="text-brass" />
                <p className="font-mono text-xs text-ink-muted">
                  {new Date(m.created_at).toLocaleDateString()}
                </p>
              </div>
              <p className="text-ink text-sm leading-relaxed whitespace-pre-wrap">
                {m.client_summary ?? "Still being prepared…"}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
