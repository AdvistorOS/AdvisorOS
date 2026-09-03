"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Branding } from "./Branding";
import { ArrowLeft, UserPlus, UserMinus, Copy, Check, Trash2 } from "lucide-react";

export default function FirmDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [firm, setFirm] = useState<any>(null);
  const [advisers, setAdvisers] = useState<any[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string; emailSent: boolean } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const { data: f } = await supabase.from("firms").select("*").eq("id", id).single();
    setFirm(f);
    const res = await fetch("/api/admin/firm-advisers", { method: "POST", body: JSON.stringify({ firmId: id }) });
    const data = await res.json();
    setAdvisers(res.ok ? data.advisers : []);
  }
  useEffect(() => { load(); }, [id]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/admin/create-adviser", {
      method: "POST",
      body: JSON.stringify({ email, fullName: name, firmId: id }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult(data);
      setName("");
      setEmail("");
      load();
    } else {
      setError(data.error);
    }
    setSaving(false);
  }

  async function handleRemove(adviserId: string) {
    if (!confirm("Remove this adviser's access to the firm? Their historical client data stays intact.")) return;
    const res = await fetch("/api/admin/remove-adviser", {
      method: "POST",
      body: JSON.stringify({ adviserId }),
    });
    if (res.ok) load();
  }

  async function handleDeleteFirm() {
    setDeleting(true);
    const res = await fetch("/api/admin/delete-firm", {
      method: "POST",
      body: JSON.stringify({ firmId: id }),
    });
    if (res.ok) {
      router.push("/admin/firms");
    } else {
      setDeleting(false);
    }
  }

  function copyCredentials() {
    if (!result) return;
    navigator.clipboard.writeText(`Login: https://advisor-os-fawn.vercel.app\nEmail: ${result.email}\nPassword: ${result.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-paper px-6 py-16">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/admin/firms" className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-teal transition">
            <ArrowLeft size={13} /> Firms
          </Link>
          {!confirmingDelete ? (
            <button onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-warn transition">
              <Trash2 size={13} /> Delete firm
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-warn">Delete this firm?</span>
              <button onClick={handleDeleteFirm} disabled={deleting}
                className="text-xs bg-warn text-paper px-2.5 py-1 rounded-md hover:opacity-90 transition disabled:opacity-50">
                {deleting ? "Deleting…" : "Confirm"}
              </button>
              <button onClick={() => setConfirmingDelete(false)}
                className="text-xs text-ink-muted px-2.5 py-1 rounded-md hover:bg-border transition">
                Cancel
              </button>
            </div>
          )}
        </div>

        <p className="font-display text-2xl text-ink text-center">{firm?.name ?? "…"}</p>

        <Branding firmId={id} firmName={firm?.name ?? ""} />

        <div className="bg-surface border border-border rounded-xl p-6 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={15} className="text-teal" />
            <p className="font-mono text-xs text-teal uppercase tracking-widest">Invite adviser</p>
          </div>
          <form onSubmit={handleInvite} className="space-y-3">
            <input placeholder="Adviser name" required value={name} onChange={(e) => setName(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
            <input placeholder="Adviser email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
            <button type="submit" disabled={saving}
              className="bg-teal text-paper text-sm px-4 py-2.5 rounded-md w-full hover:opacity-90 transition disabled:opacity-50">
              {saving ? "Inviting…" : "Invite"}
            </button>
          </form>
          {error && <p className="text-warn text-xs mt-2">{error}</p>}
          {result && (
            <div className="bg-good-soft border border-good/20 rounded-md p-4 mt-3">
              <p className="text-xs text-ink-muted mb-1">{result.emailSent ? "Emailed automatically" : "Email failed — copy manually"}</p>
              <p className="font-mono text-xs text-ink">{result.email}</p>
              <p className="font-mono text-xs text-ink mb-2">{result.password}</p>
              <button onClick={copyCredentials} className="flex items-center gap-1.5 text-xs text-teal hover:underline">
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>

        <div>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">
            Advisers ({advisers?.length ?? 0})
          </p>
          {advisers !== null && advisers.length === 0 && (
            <p className="text-sm text-ink-muted">No advisers yet — invite one above.</p>
          )}
          <div className="space-y-2">
            {advisers?.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
                <div>
                  <p className="text-sm text-ink">{a.full_name}</p>
                  <p className="text-xs text-ink-muted">{a.email}</p>
                </div>
                <button onClick={() => handleRemove(a.id)}
                  className="flex items-center gap-1.5 text-xs text-warn hover:underline">
                  <UserMinus size={13} /> Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
