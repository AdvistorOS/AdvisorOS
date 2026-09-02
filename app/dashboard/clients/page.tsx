"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { User, Plus, X, Upload, Trash2, Check } from "lucide-react";
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

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

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

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set((clients ?? []).map((c) => c.id)));
  }

  async function handleBatchDelete() {
    setDeleting(true);
    const res = await fetch("/api/delete-clients-batch", {
      method: "POST",
      body: JSON.stringify({ clientIds: Array.from(selected) }),
    });
    const data = await res.json();
    setDeleting(false);
    setConfirming(false);
    if (res.ok) {
      toast(`${data.deletedCount} client${data.deletedCount !== 1 ? "s" : ""} deleted`);
      setSelected(new Set());
      setSelectMode(false);
      load();
    } else {
      toast(data.error ?? "Delete failed", "error");
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-8 py-10 pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Clients</h1>
          <p className="text-ink-muted text-sm mt-0.5">{clients?.length ?? 0} client{clients?.length !== 1 ? "s" : ""} on file.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleSelectMode}
            className={`text-sm px-3 py-2.5 rounded-md transition flex items-center gap-1.5
              ${selectMode ? "bg-ink text-paper" : "text-ink-muted hover:bg-teal-soft"}`}>
            <Check size={15} /> {selectMode ? "Cancel" : "Select"}
          </button>
          {!selectMode && (
            <>
              <Link href="/dashboard/clients/import"
                className="text-ink-muted text-sm px-3 py-2.5 rounded-md hover:bg-teal-soft transition flex items-center gap-1.5">
                <Upload size={15} /> Import
              </Link>
              <button onClick={() => setModalOpen(true)}
                className="bg-teal text-paper text-sm px-4 py-2.5 rounded-md hover:opacity-90 transition flex items-center gap-2 card-shadow">
                <Plus size={16} /> New client
              </button>
            </>
          )}
        </div>
      </div>

      {selectMode && (
        <div className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-2.5 mb-4 card-shadow">
          <p className="text-xs text-ink-muted">{selected.size} selected</p>
          <button onClick={selectAll} className="text-xs text-teal hover:underline">Select all</button>
        </div>
      )}

      {clients === null && <LoadingDots label="Loading clients…" />}
      {clients !== null && !clients.length && (
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <User size={22} className="text-ink-muted mx-auto mb-3" />
          <p className="text-sm text-ink-muted">No clients yet — add your first one above.</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {clients?.map((c) => {
          const isSelected = selected.has(c.id);
          const CardInner = (
            <>
              <div className="w-9 h-9 rounded-full bg-teal-soft flex items-center justify-center flex-shrink-0">
                <User size={15} className="text-teal" />
              </div>
              <p className="text-ink font-medium text-sm flex-1">{c.full_name}</p>
            </>
          );
          return selectMode ? (
            <button key={c.id} onClick={() => toggleSelect(c.id)}
              className={`flex items-center gap-3 border rounded-xl px-5 py-4 transition text-left
                ${isSelected ? "bg-teal-soft border-teal" : "bg-surface border-border card-shadow"}`}>
              <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0
                ${isSelected ? "bg-teal border-teal" : "border-border"}`}>
                {isSelected && <Check size={13} className="text-paper" />}
              </div>
              {CardInner}
            </button>
          ) : (
            <Link key={c.id} href={`/dashboard/clients/${c.id}`}
              className="flex items-center gap-3 bg-surface border border-border rounded-xl px-5 py-4 card-shadow card-shadow-hover transition">
              {CardInner}
            </Link>
          );
        })}
      </div>

      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border px-6 py-4 flex items-center justify-center gap-3 z-40">
          {!confirming ? (
            <button onClick={() => setConfirming(true)}
              className="flex items-center gap-2 bg-warn text-paper text-sm font-medium px-5 py-2.5 rounded-md hover:opacity-90 transition">
              <Trash2 size={15} /> Delete {selected.size} client{selected.size !== 1 ? "s" : ""}
            </button>
          ) : (
            <>
              <span className="text-sm text-warn">Delete {selected.size} client{selected.size !== 1 ? "s" : ""} and all their data? This can't be undone.</span>
              <button onClick={handleBatchDelete} disabled={deleting}
                className="bg-warn text-paper text-sm font-medium px-4 py-2 rounded-md hover:opacity-90 transition disabled:opacity-50">
                {deleting ? "Deleting…" : "Confirm"}
              </button>
              <button onClick={() => setConfirming(false)} className="text-sm text-ink-muted px-3 py-2">
                Cancel
              </button>
            </>
          )}
        </div>
      )}

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
