"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    async function run() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          router.replace("/dashboard");
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace("/dashboard");
      }
    }
    run();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace("/dashboard");
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-ink-muted text-sm">Signing you in…</p>
    </div>
  );
}
