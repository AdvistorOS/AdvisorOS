"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ meetingId, status, intervalMs = 5000 }: { meetingId: string; status: string; intervalMs?: number }) {
  const router = useRouter();
  const triggered = useRef(false);

  useEffect(() => {
    if (status === "extracting" && !triggered.current) {
      triggered.current = true;
      fetch("/api/extract-facts", {
        method: "POST",
        body: JSON.stringify({ meetingId }),
      });
    }
  }, [status, meetingId]);

  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, router]);

  return null;
}
