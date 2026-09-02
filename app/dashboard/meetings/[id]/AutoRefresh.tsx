"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_AUTO_RETRIES = 5;

export function AutoRefresh({ meetingId, status, intervalMs = 5000 }: { meetingId: string; status: string; intervalMs?: number }) {
  const router = useRouter();
  const attemptCount = useRef(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if ((status === "extracting" || status === "summarizing") && attemptCount.current < MAX_AUTO_RETRIES) {
      attemptCount.current += 1;
      setRetrying(true);
      fetch("/api/extract-facts", {
        method: "POST",
        body: JSON.stringify({ meetingId }),
      })
        .catch(() => {})
        .finally(() => setRetrying(false));
    }
  }, [status, meetingId]);

  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, router]);

  // Reset the attempt counter whenever we land on a genuinely new meeting
  useEffect(() => {
    attemptCount.current = 0;
  }, [meetingId]);

  return null;
}
