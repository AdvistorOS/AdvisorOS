"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";

type Firm = { id: string; name: string };
type Adviser = { id: string; full_name: string; email: string; firm_id: string | null };

export function AdviserRow({ adviser, firms }: { adviser: Adviser; firms: Firm[] }) {
  const router = useRouter();
  const [firmId, setFirmId] = useState(adviser.firm_id ?? "");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleFirmChange(newFirmId: string) {
    setFirmId(newFirmId);
    setSaving(true);
    await fetch("/api/admin/reassign-adviser", {
      method: "POST",
      body: JSON.stringify({ adviserId: adviser.id, firmId: newFirmId }),
    });
    setSaving(false);
    router.refresh();
  }

  async function handleRemove() {
    setRemoving(true);
    const res = await fetch("/api/admin/remove-adviser", {
      method: "POST",
      body: JSON.stringify({ adviserId: adviser.id }),
    });
    if (res.ok) router.refresh();
    setRemoving(false);
    setConfirming(false);
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-surface border border-border rounded-lg px-4 py-3 card-shadow">
      <div className="min-w-0 flex-shrink-0">
        <p className="text-sm text-ink truncate">{adviser.full_name}</p>
        <p className="text-xs text-ink-muted truncate">{adviser.email}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <select value={firmId} onChange={(e) => handleFirmChange(e.target.value)} disabled={saving}
          className="border border-border rounded-md px-2 py-1.5 text-xs bg-paper text-ink focus:outline-none focus:border-teal disabled:opacity-50">
          <option value="">No firm</option>
          {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        {confirming ? (
          <div className="flex items-center gap-1.5">
            <button onClick={handleRemove} disabled={removing}
              className="text-xs bg-warn text-paper px-2.5 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50">
              {removing ? "…" : "Confirm"}
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs text-ink-muted px-2 py-1.5">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="text-warn hover:opacity-70 transition p-1.5">
            <UserMinus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
