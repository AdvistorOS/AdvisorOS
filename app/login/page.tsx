"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (!error) setSent(true);
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <p className="font-display text-2xl text-ink mb-1">AdvisorOS</p>
        <p className="text-ink-muted text-sm mb-8">Meeting intelligence for wealth advisers</p>

        {sent ? (
          <p className="text-ink text-sm">Check your email for a login link.</p>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email" required placeholder="you@yourfirm.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-border rounded-sm px-3 py-2 w-full bg-surface text-ink focus:outline-none focus:border-brass"
            />
            <button type="submit" className="bg-ink text-paper text-sm rounded-sm px-3 py-2 w-full hover:opacity-90 transition">
              Send login link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
