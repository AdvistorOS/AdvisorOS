"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ meetingId, status, enrichmentStatus = "idle", intervalMs = 2000 }: {
  meetingId: string; status: string; enrichmentStatus?: string; intervalMs?: number;
}) {
  const router = useRouter();
  const [connectionError, setConnectionError] = useState(false);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let inFlight = false;
    let controller: AbortController | undefined;
    const poll = async () => {
      if (stopped || inFlight) return;
      if (document.visibilityState !== "visible") { timer = setTimeout(poll, intervalMs); return; }
      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10_000);
      try {
        const response = await fetch(`/api/meeting-status?meetingId=${encodeURIComponent(meetingId)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unable to check progress");
        const latest = await response.json();
        if (stopped) return;
        setConnectionError(false);
        if (latest.status !== status || latest.enrichment_status !== enrichmentStatus) router.refresh();
        // One final render also surfaces recovery controls after a server interruption.
        if (latest.processing_started_at && Date.now() - new Date(latest.processing_started_at).getTime() > (latest.status === "transcribing" ? 7_200_000 : 360_000)) { router.refresh(); stopped = true; }
      } catch { if (!stopped) setConnectionError(true); }
      finally {
        clearTimeout(timeout); inFlight = false;
        if (!stopped) timer = setTimeout(poll, intervalMs);
      }
    };
    const onVisible = () => { if (document.visibilityState === "visible") { clearTimeout(timer); void poll(); } };
    timer = setTimeout(poll, intervalMs);
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", onVisible); };
  }, [meetingId, status, enrichmentStatus, intervalMs, router]);
  return connectionError ? <p role="status" className="rounded-xl border border-border bg-surface p-3 text-sm text-ink-muted">Reconnecting to check progress. Your meeting is saved.</p> : null;
}
