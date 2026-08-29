"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();
  const [debug, setDebug] = useState("starting...");

  useEffect(() => {
    const supabase = createClient();

    async function run() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hash = window.location.hash;

      setDebug(`code param: ${code ?? "none"} | hash: ${hash || "none"} | full url: ${window.location.href}`);

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setDebug((d) => d + ` | exchange error: ${error.message}`);
          return;
        }
        router.replace("/dashboard");
        return;
      }

      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      setDebug((d) => d + ` | getSession result: ${session ? "has session" : "no session"} ${sessErr ? sessErr.message : ""}`);
      if (session) router.replace("/dashboard");
    }
    run();
  }, [router]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <p className="text-ink-muted text-xs break-all max-w-lg">{debug}</p>
    </div>
  );
}
