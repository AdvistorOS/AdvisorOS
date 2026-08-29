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
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.substring(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          setDebug("setSession error: " + error.message);
          return;
        }
        router.replace("/dashboard");
        return;
      }

      setDebug("no access_token found in hash: " + hash.slice(0, 100));
    }
    run();
  }, [router]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <p className="text-ink-muted text-xs break-all max-w-lg">{debug}</p>
    </div>
  );
}
