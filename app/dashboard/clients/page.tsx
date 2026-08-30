"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { User, Plus, X } from "lucide-react";

export default function ClientsPage() {
  const supabase = createClient();
  const [clients, setClients] = useState<any[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data } = await supabase.from("clients").select("*").order("full_name");
    setClients(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in."); setSaving(false); return; }

    const { error } = await supabase.from("clients").insert({ full_name: name, email, adviser_id: user.id });
    if (error) { setError(error.message); setSaving(false); return; }

    setSaving(false);
    setModalOpen(false);
    setName("");
    setEmail("");
    load();
  }

  return (
    <main className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Clients</h1>
          <p className="text-ink-muted text-sm mt-0.5">{clients?.length ?? 0} client{clients?.length !== 1 ? "s" : ""} on file.</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="bg-teal text-paper text-sm px-4 py-2.5 rounded-md hover:opacity-90 transition flex items-center gap-2 card-shadow">
          <Plus size={16} /> New client
        </button>
      </div>

      {clients === null && <p className="text-sm text-ink-muted">Loading…</p>}
      {clients !== null && !clients.length && <p className="text-sm text-ink-muted">No clients yet.</p>}

      <div className="grid md:grid-cols-2 gap-3">
        {clients?.map((c) => (
          <Link key={c.id} href={`/dashboard/clients/${c.id}`}
            className="flex items-center gap-3 bg-surface border border-border rounded-xl px-5 py-4 card-shadow card-shadow-hover transition">
            <div className="w-9 h-9 rounded-full bg-teal-soft flex items-center justify-center flex-shrink-0">
              <User size={15} className="text-teal" />
            </div>
            <p className="text-ink font-medium text-sm">{c.full_name}</p>
          </Link>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-6" onClick={() => setModalOpen(false)}>
          <div className="bg-surface border border-border rounded-xl p-6 card-shadow max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-lg text-ink">New client</p>
              <button onClick={() => setModalOpen(false)}><X size={18} className="text-ink-muted" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <input placeholder="Client name" required value={name} onChange={(e) => setName(e.target.value)}
                className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
              <input placeholder="Client email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
              <button type="submit" disabled={saving}
                className="bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
                {saving ? "Creating…" : "Create client"}
              </button>
              {error && <p className="text-xs text-warn">{error}</p>}
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
