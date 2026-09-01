"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Building2, Users, ArrowLeft, UserPlus, Copy, Check } from "lucide-react";

export default function AdminPage() {
  const supabase = createClient();
  const [firmName, setFirmName] = useState("");
  const [practiceType, setPracticeType] = useState("wealth_management");
  const [error, setError] = useState("");

  const [firms, setFirms] = useState<{ id: string; name: string }[]>([]);
  const [adviserName, setAdviserName] = useState("");
  const [adviserEmail, setAdviserEmail] = useState("");
  const [adviserFirm, setAdviserFirm] = useState("");
  const [adviserSaving, setAdviserSaving] = useState(false);
  const [adviserResult, setAdviserResult] = useState<{ email: string; password: string; emailSent: boolean } | null>(null);
  const [adviserError, setAdviserError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.from("firms").select("id, name").order("name").then(({ data }) => setFirms(data ?? []));
  }, []);

  async function handleCreateFirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/create-firm", {
      method: "POST",
      body: JSON.stringify({ name: firmName, practiceType }),
    });
    const data = await res.json();
    if (res.ok) window.location.href = `/admin/firms/${data.firm.id}`;
    else setError(data.error);
  }

  async function handleInviteAdviser(e: React.FormEvent) {
    e.preventDefault();
    setAdviserSaving(true);
    setAdviserError("");
    setAdviserResult(null);
    const res = await fetch("/api/admin/create-adviser", {
      method: "POST",
      body: JSON.stringify({ email: adviserEmail, fullName: adviserName, firmId: adviserFirm || null }),
    });
    const data = await res.json();
    if (res.ok) {
      setAdviserResult(data);
      setAdviserName("");
      setAdviserEmail("");
    } else {
      setAdviserError(data.error);
    }
    setAdviserSaving(false);
  }

  function copyCredentials() {
    if (!adviserResult) return;
    navigator.clipboard.writeText(`Login: https://advisor-os-fawn.vercel.app\nEmail: ${adviserResult.email}\nPassword: ${adviserResult.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-paper flex items-start justify-center px-6 py-16">
      <div className="max-w-sm w-full space-y-6">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-teal transition">
          <ArrowLeft size={13} /> Back to my dashboard
        </Link>

        <p className="font-display text-xl text-ink text-center">AdvisorOS Admin</p>

        <div className="bg-surface border border-border rounded-xl p-6 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={15} className="text-teal" />
            <p className="font-mono text-xs text-teal uppercase tracking-widest">Invite adviser</p>
          </div>
          <form onSubmit={handleInviteAdviser} className="space-y-3">
            <input placeholder="Adviser name" required value={adviserName} onChange={(e) => setAdviserName(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
            <input placeholder="Adviser email" type="email" required value={adviserEmail} onChange={(e) => setAdviserEmail(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
            <select value={adviserFirm} onChange={(e) => setAdviserFirm(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal">
              <option value="">No firm (assign later)</option>
              {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button type="submit" disabled={adviserSaving}
              className="bg-teal text-paper text-sm px-4 py-2.5 rounded-md w-full hover:opacity-90 transition disabled:opacity-50">
              {adviserSaving ? "Inviting…" : "Invite"}
            </button>
          </form>
          {adviserError && <p className="text-warn text-xs mt-2">{adviserError}</p>}
          {adviserResult && (
            <div className="bg-good-soft border border-good/20 rounded-md p-4 mt-3">
              <p className="text-xs text-ink-muted mb-1">{adviserResult.emailSent ? "Emailed automatically" : "Email failed — copy manually"}</p>
              <p className="font-mono text-xs text-ink">{adviserResult.email}</p>
              <p className="font-mono text-xs text-ink mb-2">{adviserResult.password}</p>
              <button onClick={copyCredentials} className="flex items-center gap-1.5 text-xs text-teal hover:underline">
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} className="text-teal" />
            <p className="font-mono text-xs text-teal uppercase tracking-widest">New firm</p>
          </div>
          <form onSubmit={handleCreateFirm} className="space-y-3">
            <input placeholder="Firm name" required value={firmName} onChange={(e) => setFirmName(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
            <select value={practiceType} onChange={(e) => setPracticeType(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal">
              <option value="wealth_management">Wealth management / financial advice</option>
              <option value="profit_consulting">Profit / business consulting</option>
            </select>
            <button type="submit" className="bg-teal text-paper text-sm px-4 py-2.5 rounded-md w-full hover:opacity-90 transition">Create</button>
          </form>
          {error && <p className="text-warn text-xs mt-2">{error}</p>}
        </div>

        <Link href="/admin/firms"
          className="block text-center bg-surface border border-border rounded-xl p-4 text-sm text-ink hover:bg-teal-soft transition card-shadow">
          Manage firms →
        </Link>

        <Link href="/admin/advisers"
          className="flex items-center justify-center gap-2 bg-surface border border-border rounded-xl p-4 text-sm text-ink hover:bg-teal-soft transition card-shadow">
          <Users size={15} /> All advisers →
        </Link>
      </div>
    </div>
  );
}
