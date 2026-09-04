"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, Loader2, Check } from "lucide-react";
import { useToast } from "@/app/dashboard/ToastProvider";

export function CrmUpdate({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [update, setUpdate] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/update-crm", { method: "POST", body: JSON.stringify({ meetingId }) });
    const data = await res.json();
    setLoading(false);
    if (res.ok) { setUpdate(data.update); toast("Client signals updated"); router.refresh(); }
    else setError(data.error ?? "Something went wrong");
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-6 card-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radar size={15} className="text-teal" />
          <p className="font-mono text-xs text-teal uppercase tracking-widest">Update client signals</p>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-1.5 bg-teal text-paper text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {loading ? "Updating…" : update ? "Re-run" : "Update"}
        </button>
      </div>

      {error && <p className="text-xs text-warn">{error}</p>}
      {!update && !loading && !error && (
        <p className="text-xs text-ink-muted">Sets the live next action and current risk on the client record from this meeting.</p>
      )}

      {update && (
        <div className="space-y-2">
          <div className="bg-good-soft border border-good/20 rounded-lg px-4 py-3">
            <p className="text-xs text-ink-muted">Next action</p>
            <p className="text-sm text-ink">{update.next_action}</p>
          </div>
          {update.risk_note && (
            <div className="bg-warn-soft border border-warn/20 rounded-lg px-4 py-3">
              <p className="text-xs text-ink-muted">Risk</p>
              <p className="text-sm text-ink">{update.risk_note}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
