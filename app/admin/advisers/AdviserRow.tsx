"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, Trash2, X, UserPlus2 } from "lucide-react";

type Firm = { id: string; name: string };
type Adviser = { id: string; full_name: string; email: string; firm_id: string | null; role?: string | null };

export function AdviserRow({ adviser, firms }: { adviser: Adviser; firms: Firm[] }) {
  const router = useRouter();
  const [firmId, setFirmId] = useState(adviser.firm_id ?? "");
  const [role, setRole] = useState(adviser.role ?? "adviser");
  const [savingRole, setSavingRole] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [permDeleteModal, setPermDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [addClientModal, setAddClientModal] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [addingClient, setAddingClient] = useState(false);
  const [addClientError, setAddClientError] = useState("");
  const [addedConfirm, setAddedConfirm] = useState("");

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

  async function handleRoleChange(newRole: string) {
    setRole(newRole);
    setSavingRole(true);
    await fetch("/api/admin/set-role", {
      method: "POST",
      body: JSON.stringify({ adviserId: adviser.id, role: newRole }),
    });
    setSavingRole(false);
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
    setConfirmingRemove(false);
  }

  async function handlePermanentDelete() {
    setDeleting(true);
    const res = await fetch("/api/admin/permanently-delete-adviser", {
      method: "POST",
      body: JSON.stringify({ adviserId: adviser.id }),
    });
    if (res.ok) router.refresh();
    setDeleting(false);
    setPermDeleteModal(false);
    setConfirmText("");
  }

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    setAddingClient(true);
    setAddClientError("");
    const res = await fetch("/api/admin/create-client-for-adviser", {
      method: "POST",
      body: JSON.stringify({ adviserId: adviser.id, name: clientName, email: clientEmail }),
    });
    const data = await res.json();
    setAddingClient(false);
    if (res.ok) {
      setAddedConfirm(`${clientName} added`);
      setClientName("");
      setClientEmail("");
      setTimeout(() => { setAddClientModal(false); setAddedConfirm(""); }, 1200);
    } else {
      setAddClientError(data.error);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 bg-surface border border-border rounded-lg px-4 py-3 card-shadow flex-wrap">
        <div className="min-w-0 flex-shrink-0">
          <p className="text-sm text-ink truncate">{adviser.full_name}</p>
          <p className="text-xs text-ink-muted truncate">{adviser.email}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <select value={firmId} onChange={(e) => handleFirmChange(e.target.value)} disabled={saving}
            className="border border-border rounded-md px-2 py-1.5 text-xs bg-paper text-ink focus:outline-none focus:border-teal disabled:opacity-50">
            <option value="">No firm</option>
            {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          <select value={role} onChange={(e) => handleRoleChange(e.target.value)} disabled={savingRole}
            title="Managers can see their whole firm's performance and flags on the Team page"
            className="border border-border rounded-md px-2 py-1.5 text-xs bg-paper text-ink focus:outline-none focus:border-teal disabled:opacity-50">
            <option value="adviser">Adviser</option>
            <option value="manager">Manager</option>
          </select>

          <button onClick={() => setAddClientModal(true)} title="Add a client for this adviser"
            className="text-teal hover:opacity-70 transition p-1.5">
            <UserPlus2 size={14} />
          </button>

          {confirmingRemove ? (
            <div className="flex items-center gap-1.5">
              <button onClick={handleRemove} disabled={removing}
                className="text-xs bg-warn text-paper px-2.5 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50">
                {removing ? "…" : "Confirm"}
              </button>
              <button onClick={() => setConfirmingRemove(false)} className="text-xs text-ink-muted px-2 py-1.5">
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => { if (confirm(`Revoke login access for ${adviser.full_name}? They will not be able to sign in until re-enabled.`)) setConfirmingRemove(true); }}
                title="Remove access (keeps their data)"
                className="text-warn hover:opacity-70 transition p-1.5">
                <UserMinus size={14} />
              </button>
              <button onClick={() => setPermDeleteModal(true)} title="Permanently delete everything"
                className="text-ink-muted hover:text-warn transition p-1.5">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {addClientModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-6"
          onClick={() => { setAddClientModal(false); setClientName(""); setClientEmail(""); setAddClientError(""); }}>
          <div className="bg-surface border border-border rounded-xl p-6 card-shadow max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-lg text-ink">New client for {adviser.full_name}</p>
              <button onClick={() => setAddClientModal(false)}><X size={18} className="text-ink-muted" /></button>
            </div>
            <form onSubmit={handleAddClient} className="space-y-3">
              <input placeholder="Client name" required value={clientName} onChange={(e) => setClientName(e.target.value)}
                className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
              <input placeholder="Client email (optional)" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
              <button type="submit" disabled={addingClient}
                className="bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
                {addingClient ? "Adding…" : "Add client"}
              </button>
              {addClientError && <p className="text-warn text-xs">{addClientError}</p>}
              {addedConfirm && <p className="text-good text-xs">{addedConfirm}</p>}
            </form>
          </div>
        </div>
      )}

      {permDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6"
          onClick={() => { setPermDeleteModal(false); setConfirmText(""); }}>
          <div className="bg-surface border border-warn/40 rounded-xl p-6 card-shadow max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-lg text-warn">Permanently delete</p>
              <button onClick={() => { setPermDeleteModal(false); setConfirmText(""); }}><X size={18} className="text-ink-muted" /></button>
            </div>
            <p className="text-sm text-ink mb-1">
              This will permanently delete <span className="font-medium">{adviser.full_name}</span> and every client, meeting, transcript, and note they own.
            </p>
            <p className="text-xs text-warn mb-4">This cannot be undone. Client data is destroyed, not just access revoked.</p>
            <p className="text-xs text-ink-muted mb-1.5">Type <span className="font-mono font-medium">{adviser.full_name}</span> to confirm:</p>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
              className="border border-warn/40 rounded-md px-3 py-2 w-full bg-paper text-ink text-sm mb-4 focus:outline-none focus:border-warn" />
            <button onClick={handlePermanentDelete} disabled={confirmText !== adviser.full_name || deleting}
              className="bg-warn text-paper text-sm font-medium rounded-md px-4 py-2.5 w-full hover:opacity-90 transition disabled:opacity-40">
              {deleting ? "Deleting…" : "Permanently delete"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
