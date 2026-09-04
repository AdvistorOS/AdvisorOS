"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Pencil, Loader2 } from "lucide-react";

export function IntelligenceControls({ objectId, currentValue, currentStatus }: {
  objectId: string; currentValue: string; currentStatus: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentValue);
  const [busy, setBusy] = useState(false);

  async function setStatus(status: string, newValue?: string) {
    setBusy(true);
    await fetch("/api/validate-intelligence", {
      method: "POST",
      body: JSON.stringify({ objectId, validationStatus: status, newValue }),
    });
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  if (currentStatus === "rejected") {
    return <span className="text-[10px] font-mono text-warn">Rejected</span>;
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 w-full mt-2">
        <input value={value} onChange={(e) => setValue(e.target.value)}
          className="border border-border rounded-md px-2 py-1 text-xs flex-1 bg-paper text-ink focus:outline-none focus:border-teal" />
        <button onClick={() => setStatus("edited", value)} disabled={busy}
          className="text-xs text-teal hover:underline">Save</button>
        <button onClick={() => setEditing(false)} className="text-xs text-ink-muted">Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {busy && <Loader2 size={11} className="animate-spin text-ink-muted" />}
      {currentStatus === "accepted" || currentStatus === "edited" ? (
        <span className="text-[10px] font-mono text-good flex items-center gap-1">
          <Check size={9} /> {currentStatus}
        </span>
      ) : (
        <>
          <button onClick={() => setStatus("accepted")} disabled={busy}
            title="Accept" className="text-good hover:opacity-70 transition">
            <Check size={12} />
          </button>
          <button onClick={() => setEditing(true)} disabled={busy}
            title="Edit" className="text-ink-muted hover:text-teal transition">
            <Pencil size={11} />
          </button>
          <button onClick={() => setStatus("rejected")} disabled={busy}
            title="Reject" className="text-ink-muted hover:text-warn transition">
            <X size={12} />
          </button>
        </>
      )}
    </div>
  );
}
