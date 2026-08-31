"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { User, Plus, X, Upload } from "lucide-react";
import { LoadingDots } from "../LoadingDots";
import { useToast } from "../ToastProvider";

export default function ClientsPage() {
  const supabase = createClient();
  const toast = useToast();
  const [clients, setClients] = useState<any[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await supabase.from("clients").select("*").order("full_name");
    setClients(data ?? []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (modalOpen) setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [modalOpen]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in."); setSaving(false); return; }

    const { error } = await supabase.from("clients").insert({
      full_name: name,
      email: email.trim() || null,
      adviser_id: user.id,
    });
    if (error) { setError(error.message); toast(error.message, "error"); setSaving(false); return; }

    setSaving(false);
    setModalOpen(false);
    toast(`${name} added`);
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
        <div className="flex items-center gap-2">
          <Link href="/dashboard/clients/import"
            className="text-ink-muted text-sm px-3 py-2.5 rounded-md hover:bg-teal-soft transition flex items-center gap-1.5">
            <Upload size={15} /> Import
          </Link>
          <button onClick={() => setModalOpen(true)}
            className="bg-teal text-paper text-sm px-4 py-2.5 rounded-md hover:opacity-90 transition flex items-center gap-2 card-shadow">
            <Plus size={16} /> New client
          </button>
        </div>
      </div>

      {clients === null && <LoadingDots label="Loading clients…" />}
      {clients !== null && !clients.length && (
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <User size={22} className="text-ink-muted mx-auto mb-3" />
          <p className="text-sm text-ink-muted">No clients yet — add your first one above.</p>
        </div>
      )}

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
              <input ref={nameInputRef} placeholder="Client name" required value={name} onChange={(e) => setName(e.target.value)}
                className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
              <input placeholder="Client email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
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
