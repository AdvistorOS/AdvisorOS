"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Circle, CheckCircle2 } from "lucide-react";

export default function TasksPage() {
  const supabase = createClient();
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from("actions").select("*, clients(id, full_name)").eq("status", "open").order("created_at");
    setActions(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function complete(id: string) {
    setActions((prev) => prev.filter((a) => a.id !== id));
    await supabase.from("actions").update({ status: "done" }).eq("id", id);
  }

  const grouped: Record<string, { name: string; items: any[] }> = {};
  for (const a of actions) {
    const clientId = a.clients?.id ?? "unknown";
    const name = a.clients?.full_name ?? "Unknown client";
    if (!grouped[clientId]) grouped[clientId] = { name, items: [] };
    grouped[clientId].items.push(a);
  }
  const groups = Object.entries(grouped).sort((a, b) => a[1].name.localeCompare(b[1].name));

  if (loading) return <main className="max-w-3xl mx-auto px-8 py-10 text-sm text-ink-muted">Loading…</main>;

  return (
    <main className="max-w-3xl mx-auto px-8 py-10">
      <h1 className="font-display text-3xl text-ink mb-1">Tasks</h1>
      <p className="text-ink-muted text-sm mb-8">{actions.length} outstanding.</p>

      {groups.length === 0 && <p className="text-sm text-ink-muted">Nothing outstanding.</p>}

      <div className="space-y-8">
        {groups.map(([clientId, group]) => (
          <div key={clientId}>
            <div className="flex items-center gap-2 mb-3">
              <Link href={`/dashboard/clients/${clientId}`} className="font-display text-lg text-ink hover:text-teal transition">
                {group.name}
              </Link>
              <span className="font-mono text-xs text-ink-muted">({group.items.length})</span>
            </div>
            <div className="space-y-2">
              {group.items.map((a) => (
                <div key={a.id} className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
                  <button onClick={() => complete(a.id)} className="text-ink-muted hover:text-good transition flex-shrink-0">
                    <Circle size={18} />
                  </button>
                  <p className="text-sm text-ink flex-1">{a.description}</p>
                  <span className="font-mono text-xs text-ink-muted">{a.owner}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
