"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SettingsPage() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Updating…");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setStatus("Error: " + error.message);
    else { setStatus("Password updated."); setPassword(""); }
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
          <h1 className="font-display text-2xl text-ink mb-1">Change password</h1>
          <p className="text-ink-muted text-sm mb-7">Set a new password for your account.</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="password" required minLength={8} placeholder="New password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition" />
            <button type="submit"
              className="bg-ink text-paper text-sm font-medium rounded-md px-3 py-2.5 w-full hover:opacity-90 transition">
              Update password
            </button>
            {status && <p className="font-mono text-xs text-ink-muted">{status}</p>}
          </form>
        </div>
      </main>
    </div>
  );
}
