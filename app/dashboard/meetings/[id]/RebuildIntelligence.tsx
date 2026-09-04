"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Loader2 } from "lucide-react";

export function RebuildIntelligence({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  async function run() {
    setBusy(true);
    setResult("");
    const res = await fetch("/api/build-intelligence", {
      method: "POST",
      body: JSON.stringify({ meetingId }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setResult(`${data.created} recorded, ${data.superseded} superseded`);
      router.refresh();
    } else {
      setResult(data.error ?? "Failed");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={run} disabled={busy}
        className="flex items-center gap-1.5 bg-teal-soft text-teal text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-80 transition disabled:opacity-50">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
        {busy ? "Building…" : "Rebuild intelligence"}
      </button>
      {result && <span className="text-xs text-ink-muted">{result}</span>}
    </div>
  );
}
