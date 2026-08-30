import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: actions } = await supabase.from("actions").select("*, clients(id, full_name)").eq("status", "open").order("created_at");

  return (
    <main className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="font-display text-3xl text-ink mb-1">Tasks</h1>
      <p className="text-ink-muted text-sm mb-8">{actions?.length ?? 0} outstanding.</p>

      <div className="space-y-2.5">
        {actions?.map((a: any) => (
          <div key={a.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-5 py-3.5 card-shadow">
            <div>
              <p className="text-sm text-ink">{a.description}</p>
              <Link href={`/dashboard/clients/${a.clients?.id}`} className="text-xs text-teal hover:underline">{a.clients?.full_name}</Link>
            </div>
            <span className="font-mono text-xs text-ink-muted">{a.owner}</span>
          </div>
        ))}
        {!actions?.length && <p className="text-sm text-ink-muted">Nothing outstanding.</p>}
      </div>
    </main>
  );
}
