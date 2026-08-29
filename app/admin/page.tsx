"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Building2, UserPlus, Copy, Check, Mail } from "lucide-react";

export default function AdminPage() {
  const [firms, setFirms] = useState<{ id: string; name: string }[]>([]);
  const [firmName, setFirmName] = useState("");
  const [selectedFirm, setSelectedFirm] = useState("");
  const [adviserEmail, setAdviserEmail] = useState("");
  const [adviserName, setAdviserName] = useState("");
  const [result, setResult] = useState<{ email: string; password: string; emailSent: boolean; emailError?: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const supabase = createClient();

  async function loadFirms() {
    const { data } = await supabase.from("firms").select("id, name").order("name");
    if (data) setFirms(data);
  }
  useEffect(() => { loadFirms(); }, []);

  async function handleCreateFirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/create-firm", { method: "POST", body: JSON.stringify({ name: firmName }) });
    const data = await res.json();
    if (res.ok) { setFirmName(""); loadFirms(); } else { setError(data.error); }
  }

  async function handleCreateAdviser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    const res = await fetch("/api/admin/create-adviser", {
      method: "POST",
      body: JSON.stringify({ email: adviserEmail, fullName: adviserName, firmId: selectedFirm }),
    });
    const data = await res.json();
    if (res.ok) { setResult(data); setAdviserEmail(""); setAdviserName(""); } else { setError(data.error); }
  }

  function copyCredentials() {
    if (!result) return;
    navigator.clipboard.writeText(`Login: https://advisor-os-fawn.vercel.app\nEmail: ${result.email}\nPassword: ${result.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border px-8 py-5">
        <span className="font-display text-xl text-ink">AdvisorOS — Admin</span>
      </header>

      <main className="max-w-xl mx-auto px-6 py-12 space-y-10">
        <section className="bg-surface border border-border rounded-xl p-7 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-brass" />
            <h2 className="font-display text-lg text-ink">New firm</h2>
          </div>
          <form onSubmit={handleCreateFirm} className="flex gap-2">
            <input placeholder="Firm name" required value={firmName} onChange={(e) => setFirmName(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 flex-1 bg-paper text-ink text-sm focus:outline-none focus:border-brass" />
            <button type="submit" className="bg-ink text-paper text-sm px-4 rounded-md hover:opacity-90 transition">Create</button>
          </form>
        </section>

        <section className="bg-surface border border-border rounded-xl p-7 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={16} className="text-brass" />
            <h2 className="font-display text-lg text-ink">New adviser login</h2>
          </div>
          <form onSubmit={handleCreateAdviser} className="space-y-3">
            <select required value={selectedFirm} onChange={(e) => setSelectedFirm(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-brass">
              <option value="">Select firm…</option>
              {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <input placeholder="Adviser name" required value={adviserName} onChange={(e) => setAdviserName(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-brass" />
            <input placeholder="Adviser email" type="email" required value={adviserEmail} onChange={(e) => setAdviserEmail(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-brass" />
            <button type="submit" className="bg-ink text-paper text-sm px-4 py-2.5 rounded-md w-full hover:opacity-90 transition">
              Create login
            </button>
          </form>
          {error && <p className="text-warn text-xs mt-3">{error}</p>}
          {result && (
            <div className="mt-5 bg-good-soft border border-good/20 rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail size={13} className={result.emailSent ? "text-good" : "text-warn"} />
                <p className="text-sm text-ink font-medium">
                  {result.emailSent ? "Emailed to them automatically" : "Email failed — send manually"}
                </p>
              </div>
              <p className="font-mono text-xs text-ink">URL: https://advisor-os-fawn.vercel.app</p>
              <p className="font-mono text-xs text-ink">Email: {result.email}</p>
              <p className="font-mono text-xs text-ink mb-3">Password: {result.password}</p>
              {result.emailError && <p className="text-xs text-warn mb-2">{result.emailError}</p>}
              <button onClick={copyCredentials} className="flex items-center gap-1.5 text-xs text-brass hover:underline">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy all (backup)"}
              </button>
            </div>
          )}
        </section>

        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Firms ({firms.length})</p>
          <div className="space-y-2">
            {firms.map((f) => (
              <div key={f.id} className="bg-surface border border-border rounded-md px-4 py-3 text-sm text-ink">{f.name}</div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
