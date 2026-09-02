"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ meetingId, status, intervalMs = 5000 }: { meetingId: string; status: string; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    // Retry from either 'extracting' or 'summarizing' — if a previous attempt
    // died mid-flight (timeout, dropped request), this recovers it instead of
    // leaving the meeting permanently stuck with no way forward.
    if (status === "extracting" || status === "summarizing") {
      fetch("/api/extract-facts", {
        method: "POST",
        body: JSON.stringify({ meetingId }),
      }).catch(() => {});
    }
  }, [status, meetingId]);

  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, router]);

  return null;
}
