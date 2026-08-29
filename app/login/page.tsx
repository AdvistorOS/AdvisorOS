"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MailCheck } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="max-w-sm w-full bg-surface border border-border rounded-xl p-8 card-shadow">
        <p className="font-display text-2xl text-ink mb-1">AdvisorOS</p>
        <p className="text-ink-muted text-sm mb-8">Meeting intelligence for wealth advisers</p>

        {sent ? (
          <div className="flex items-start gap-3 bg-good-soft rounded-md p-4">
            <MailCheck size={18} className="text-good flex-shrink-0 mt-0.5" />
            <p className="text-ink text-sm">Check your email for a login link.</p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email" required placeholder="you@yourfirm.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition"
            />
            <button type="submit" className="bg-ink text-paper text-sm font-medium rounded-md px-3 py-2.5 w-full hover:opacity-90 transition">
              Send login link
            </button>
            {error && <p className="text-warn text-xs">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
