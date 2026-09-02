"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ meetingId, status, intervalMs = 5000 }: { meetingId: string; status: string; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    // Safe to call repeatedly — the server only actually processes once
    // (it flips status away from 'extracting' immediately) and skips otherwise.
    // Retrying here just recovers from a dropped request instead of getting stuck forever.
    if (status === "extracting") {
      fetch("/api/extract-facts", {
        method: "POST",
        body: JSON.stringify({ meetingId }),
      }).catch(() => {
        // Silently ignore — next poll cycle will retry automatically.
      });
    }
  }, [status, meetingId]);

  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, router]);

  return null;
}
