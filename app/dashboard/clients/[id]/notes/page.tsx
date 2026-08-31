"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, StickyNote, Plus } from "lucide-react";
import { LoadingDots } from "../../../LoadingDots";
import { useToast } from "../../../ToastProvider";

export default function ClientNotesPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const toast = useToast();
  const [client, setClient] = useState<any>(null);
  const [notes, setNotes] = useState<any[] | null>(null);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: c } = await supabase.from("clients").select("full_name").eq("id", id).single();
    setClient(c);
    const { data: n } = await supabase.from("client_notes").select("*").eq("client_id", id).order("created_at", { ascending: false });
    setNotes(n ?? []);
  }
  useEffect(() => { load(); }, [id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await supabase.from("client_notes").insert({
      client_id: id, adviser_id: user.id, content: newNote.trim(),
    });
    setSaving(false);
    if (error) { toast(error.message, "error"); return; }
    setNewNote("");
    toast("Note added");
    load();
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  if (notes === null) return <main className="max-w-2xl mx-auto px-8"><LoadingDots label="Loading notes…" /></main>;

  return (
    <main className="max-w-2xl mx-auto px-8 py-10 space-y-6">
      <Link href={`/dashboard/clients/${id}`} className="text-ink-muted hover:text-teal transition flex items-center gap-1.5 text-sm">
        <ArrowLeft size={16} /> Back to {client?.full_name}
      </Link>

      <div>
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Notes</p>
        <h1 className="font-display text-2xl text-ink mt-1">{client?.full_name}</h1>
      </div>

      <form onSubmit={handleAdd} className="bg-surface border border-border rounded-xl p-5 card-shadow">
        <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a quick note — a call, an update, anything worth remembering…"
          rows={3}
          className="w-full border border-border rounded-md p-3 text-sm text-ink bg-paper focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition resize-none" />
        <button type="submit" disabled={saving || !newNote.trim()}
          className="flex items-center gap-1.5 bg-teal text-paper text-xs font-medium rounded-md px-3.5 py-2 mt-3 hover:opacity-90 transition disabled:opacity-50">
          <Plus size={13} /> {saving ? "Adding…" : "Add note"}
        </button>
      </form>

      {notes.length === 0 && (
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <StickyNote size={22} className="text-ink-muted mx-auto mb-3" />
          <p className="text-sm text-ink-muted">No notes yet — add your first one above.</p>
        </div>
      )}

      <div className="space-y-2.5">
        {notes.map((n) => (
          <div key={n.id} className="bg-surface border border-border rounded-lg p-4 card-shadow">
            <p className="text-sm text-ink whitespace-pre-wrap">{n.content}</p>
            <p className="font-mono text-xs text-ink-muted mt-2">{formatDate(n.created_at)}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
