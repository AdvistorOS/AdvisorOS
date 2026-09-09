"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

export function RetryButton({ meetingId }: { meetingId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function retry() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/process-meeting", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, retry: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to retry. Please try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection lost. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <div><button onClick={retry} disabled={loading}
      className="flex items-center gap-2 bg-warn text-paper text-sm font-medium rounded-md px-4 py-2.5 hover:opacity-90 transition disabled:opacity-50">
      <RotateCw size={15} className={loading ? "animate-spin" : ""} />
      {loading ? "Retrying…" : "Retry processing"}
    </button>{error && <p role="alert" className="text-sm text-warn mt-2">{error}</p>}</div>
  );
}
