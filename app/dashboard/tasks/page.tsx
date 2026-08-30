"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Circle, ChevronRight, ChevronDown } from "lucide-react";

export default function TasksPage() {
  const supabase = createClient();
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  function toggle(clientId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(clientId) ? next.delete(clientId) : next.add(clientId);
      return next;
    });
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
      <p className="text-ink-muted text-sm mb-8">{actions.length} outstanding across {groups.length} client{groups.length !== 1 ? "s" : ""}.</p>

      {groups.length === 0 && <p className="text-sm text-ink-muted">Nothing outstanding.</p>}

      <div className="space-y-2.5">
        {groups.map(([clientId, group]) => {
          const isOpen = expanded.has(clientId);
          return (
            <div key={clientId} className="bg-surface border border-border rounded-xl card-shadow overflow-hidden">
              <button onClick={() => toggle(clientId)}
                className="flex items-center justify-between w-full px-5 py-4 hover:bg-teal-soft/40 transition">
                <div className="flex items-center gap-2.5">
                  {isOpen ? <ChevronDown size={16} className="text-teal" /> : <ChevronRight size={16} className="text-ink-muted" />}
                  <span className="font-display text-base text-ink">{group.name}</span>
                </div>
                <span className="font-mono text-xs text-ink-muted">{group.items.length}</span>
              </button>

              {isOpen && (
                <div className="border-t border-border px-5 py-3 space-y-2">
                  {group.items.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 py-1.5">
                      <button onClick={() => complete(a.id)} className="text-ink-muted hover:text-good transition flex-shrink-0">
                        <Circle size={17} />
                      </button>
                      <p className="text-sm text-ink flex-1">{a.description}</p>
                      <span className="font-mono text-xs text-ink-muted">{a.owner}</span>
                    </div>
                  ))}
                  <Link href={`/dashboard/clients/${clientId}`} className="text-xs text-teal hover:underline inline-block pt-1">
                    View client record →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
