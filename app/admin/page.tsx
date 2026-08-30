"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Copy, Check } from "lucide-react";

export default function AdminPage() {
  const [firms, setFirms] = useState<{ id: string; name: string }[]>([]);
  const [firmName, setFirmName] = useState("");
  const [selectedFirm, setSelectedFirm] = useState("");
  const [adviserEmail, setAdviserEmail] = useState("");
  const [adviserName, setAdviserName] = useState("");
  const [result, setResult] = useState<{ email: string; password: string; emailSent: boolean } | null>(null);
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
    if (res.ok) {
      setFirmName("");
      await loadFirms();
      setSelectedFirm(data.firm.id);
    } else setError(data.error);
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
    if (res.ok) { setResult(data); setAdviserEmail(""); setAdviserName(""); } else setError(data.error);
  }

  function copyCredentials() {
    if (!result) return;
    navigator.clipboard.writeText(`Login: https://advisor-os-fawn.vercel.app\nEmail: ${result.email}\nPassword: ${result.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-paper flex items-start justify-center px-6 py-16">
      <div className="max-w-sm w-full space-y-6">
        <p className="font-display text-xl text-ink text-center">AdvisorOS Admin</p>

        <div className="bg-surface border border-border rounded-xl p-6 card-shadow space-y-4">
          <select value={selectedFirm} onChange={(e) => setSelectedFirm(e.target.value)}
            className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal">
            <option value="">New firm…</option>
            {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          {!selectedFirm && (
            <form onSubmit={handleCreateFirm} className="flex gap-2">
              <input placeholder="Firm name" required value={firmName} onChange={(e) => setFirmName(e.target.value)}
                className="border border-border rounded-md px-3.5 py-2.5 flex-1 bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
              <button type="submit" className="bg-ink text-paper text-sm px-4 rounded-md hover:opacity-90 transition">Create</button>
            </form>
          )}

          {selectedFirm && (
            <form onSubmit={handleCreateAdviser} className="space-y-3 pt-2 border-t border-border">
              <input placeholder="Adviser name" required value={adviserName} onChange={(e) => setAdviserName(e.target.value)}
                className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
              <input placeholder="Adviser email" type="email" required value={adviserEmail} onChange={(e) => setAdviserEmail(e.target.value)}
                className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
              <button type="submit" className="bg-teal text-paper text-sm px-4 py-2.5 rounded-md w-full hover:opacity-90 transition">
                Create login
              </button>
            </form>
          )}

          {error && <p className="text-warn text-xs">{error}</p>}

          {result && (
            <div className="bg-good-soft border border-good/20 rounded-md p-4">
              <p className="text-xs text-ink-muted mb-1">{result.emailSent ? "Emailed automatically" : "Email failed — copy manually"}</p>
              <p className="font-mono text-xs text-ink">{result.email}</p>
              <p className="font-mono text-xs text-ink mb-2">{result.password}</p>
              <button onClick={copyCredentials} className="flex items-center gap-1.5 text-xs text-teal hover:underline">
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
