"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Circle, ChevronRight, ChevronDown, CheckSquare } from "lucide-react";
import { LoadingDots } from "../LoadingDots";
import { useToast } from "../ToastProvider";

export default function TasksPage() {
  const supabase = createClient();
  const toast = useToast();
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    setError("");
    const { data, error } = await supabase
      .from("actions").select("*, clients(id, full_name)").eq("status", "open").order("created_at");
    if (error) { setError(error.message); setLoading(false); return; }
    setActions(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function complete(id: string) {
    setActions((prev) => prev.filter((a) => a.id !== id));
    const { error } = await supabase.from("actions").update({ status: "done" }).eq("id", id);
    if (error) { setError(error.message); toast(error.message, "error"); }
    else toast("Task completed");
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

  if (loading) return <main className="max-w-3xl mx-auto px-8"><LoadingDots label="Loading tasks…" /></main>;

  return (
    <main className="max-w-3xl mx-auto px-8 py-10">
      <h1 className="font-display text-3xl text-ink mb-1">Tasks</h1>
      <p className="text-ink-muted text-sm mb-8">{actions.length} outstanding across {groups.length} client{groups.length !== 1 ? "s" : ""}.</p>

      {error && (
        <div className="bg-warn-soft border border-warn/20 rounded-lg p-4 mb-6">
          <p className="font-mono text-xs text-warn">{error}</p>
        </div>
      )}

      {!error && groups.length === 0 && (
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <CheckSquare size={22} className="text-ink-muted mx-auto mb-3" />
          <p className="text-sm text-ink-muted">Nothing outstanding — you're all caught up.</p>
        </div>
      )}

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
