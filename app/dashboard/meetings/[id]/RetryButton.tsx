"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

export function RetryButton({ meetingId }: { meetingId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function retry() {
    setLoading(true);
    await fetch("/api/process-meeting", { method: "POST", body: JSON.stringify({ meetingId }) });
    router.refresh();
    setLoading(false);
  }

  return (
    <button onClick={retry} disabled={loading}
      className="flex items-center gap-2 bg-warn text-paper text-sm font-medium rounded-md px-4 py-2.5 hover:opacity-90 transition disabled:opacity-50">
      <RotateCw size={15} className={loading ? "animate-spin" : ""} />
      {loading ? "Retrying…" : "Retry processing"}
    </button>
  );
}
