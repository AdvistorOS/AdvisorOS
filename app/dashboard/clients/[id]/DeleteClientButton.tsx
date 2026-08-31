"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useToast } from "@/app/dashboard/ToastProvider";

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function handleDelete() {
    setLoading(true);
    const res = await fetch("/api/delete-client", {
      method: "POST",
      body: JSON.stringify({ clientId }),
    });
    if (res.ok) {
      toast("Client deleted");
      router.push("/dashboard/clients");
    } else {
      toast("Could not delete client", "error");
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-warn">Delete this client and all their meetings?</span>
        <button onClick={handleDelete} disabled={loading}
          className="text-xs bg-warn text-paper px-3 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50">
          {loading ? "Deleting…" : "Yes, delete"}
        </button>
        <button onClick={() => setConfirming(false)}
          className="text-xs text-ink-muted px-3 py-1.5 rounded-md hover:bg-border transition">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-warn transition">
      <Trash2 size={14} />
      Delete client
    </button>
  );
}
