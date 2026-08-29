"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.substring(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        if (!error) setReady(true);
        else setError(error.message);
      });
    } else {
      setError("This link is invalid or has expired.");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="max-w-sm w-full bg-surface border border-border rounded-xl p-8 card-shadow">
        <p className="font-display text-2xl text-ink mb-1">Set a new password</p>

        {done ? (
          <p className="text-good text-sm mt-4">Password updated — taking you to your dashboard…</p>
        ) : ready ? (
          <form onSubmit={handleSubmit} className="space-y-3 mt-6">
            <input
              type="password" required placeholder="New password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition"
            />
            <button type="submit" className="bg-ink text-paper text-sm font-medium rounded-md px-3 py-2.5 w-full hover:opacity-90 transition">
              Update password
            </button>
            {error && <p className="text-warn text-xs">{error}</p>}
          </form>
        ) : (
          <p className="text-ink-muted text-sm mt-4">{error || "Verifying link…"}</p>
        )}
      </div>
    </div>
  );
}
