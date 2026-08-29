"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus, Copy, Check } from "lucide-react";

export default function TeamPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/create-adviser", {
      method: "POST",
      body: JSON.stringify({ email, fullName }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult(data);
      setEmail("");
      setFullName("");
    } else {
      setError(data.error ?? "Something went wrong");
    }
  }

  function copyCredentials() {
    if (!result) return;
    navigator.clipboard.writeText(`Login: https://advisor-os-fawn.vercel.app\nEmail: ${result.email}\nPassword: ${result.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border px-8 py-5 flex items-center gap-4">
        <Link href="/dashboard" className="text-ink-muted hover:text-brass transition">
          <ArrowLeft size={18} />
        </Link>
        <span className="font-display text-xl text-ink">AdvisorOS</span>
      </header>

      <main className="max-w-md mx-auto px-6 py-16">
        <div className="bg-surface border border-border rounded-xl p-8 card-shadow">
          <div className="w-11 h-11 rounded-full bg-brass-soft flex items-center justify-center mb-5">
            <UserPlus size={20} className="text-brass" strokeWidth={2} />
          </div>
          <h1 className="font-display text-2xl text-ink mb-1">Add a team member</h1>
          <p className="text-ink-muted text-sm mb-7">Creates their login. You'll see the password to send them directly.</p>

          <form onSubmit={handleCreate} className="space-y-3">
            <input placeholder="Their name" required value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition" />
            <input placeholder="Their email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition" />
            <button type="submit" disabled={loading}
              className="bg-ink text-paper text-sm font-medium rounded-md px-3 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
              {loading ? "Creating…" : "Create login"}
            </button>
            {error && <p className="text-warn text-xs">{error}</p>}
          </form>

          {result && (
            <div className="mt-6 bg-good-soft border border-good/20 rounded-md p-4">
              <p className="text-sm text-ink font-medium mb-2">Account created — send these to them:</p>
              <p className="font-mono text-xs text-ink">URL: https://advisor-os-fawn.vercel.app</p>
              <p className="font-mono text-xs text-ink">Email: {result.email}</p>
              <p className="font-mono text-xs text-ink mb-3">Password: {result.password}</p>
              <button onClick={copyCredentials}
                className="flex items-center gap-1.5 text-xs text-brass hover:underline">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy all to send"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
