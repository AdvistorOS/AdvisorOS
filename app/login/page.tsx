"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

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
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setError(error.message); return; }
      router.replace("/dashboard"); router.refresh();
    } catch { setError("We couldn't connect. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 sm:p-10 card-shadow">
        <Image src="/logo-mark.svg" alt="" width={44} height={44} className="rounded-xl mb-4" />
        <p className="text-sm font-semibold text-teal mb-7">AdvisorOS</p><h1 className="font-display text-3xl text-ink mb-2">Welcome back</h1>
        <p className="text-ink-muted text-sm mb-8">Sign in to your workspace to review meetings, client records and next steps.</p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div><label htmlFor="email" className="block text-sm font-medium mb-2">Work email</label><input
            id="email" autoComplete="email" type="email" required placeholder="you@yourfirm.com" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition"
          />
          </div><div><label htmlFor="password" className="block text-sm font-medium mb-2">Password</label><input
            id="password" autoComplete="current-password" type="password" required placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition"
          />
          </div><button type="submit" disabled={loading}
            className="bg-teal text-paper text-sm font-medium rounded-md px-3 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
            {loading ? "Signing in…" : "Sign in"}
          </button>
          {error && <p role="alert" className="text-warn text-sm">{error}</p>}
        </form>
        <Link href="/forgot-password" className="text-xs text-ink-muted hover:text-teal transition block mt-4 text-center">
          Forgot password?
        </Link>
      </div>
    </div>
  );
}
