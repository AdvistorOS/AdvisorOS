"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="max-w-sm w-full bg-surface border border-border rounded-xl p-8 card-shadow">
        <p className="font-display text-2xl text-ink mb-1">AdvisorOS</p>
        <p className="text-ink-muted text-sm mb-8">Meeting intelligence for wealth advisers</p>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email" required placeholder="you@yourfirm.com" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition"
          />
          <input
            type="password" required placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition"
          />
          <button type="submit" disabled={loading}
            className="bg-ink text-paper text-sm font-medium rounded-md px-3 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
            {loading ? "Signing in…" : "Sign in"}
          </button>
          {error && <p className="text-warn text-xs">{error}</p>}
        </form>
        <Link href="/forgot-password" className="text-xs text-ink-muted hover:text-brass transition block mt-4 text-center">
          Forgot password?
        </Link>
      </div>
    </div>
  );
}
