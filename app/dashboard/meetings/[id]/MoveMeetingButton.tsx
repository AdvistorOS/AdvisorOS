"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FolderInput } from "lucide-react";

export function MoveMeetingButton({ meetingId, currentClientId }: { meetingId: string; currentClientId: string }) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      supabase.from("clients").select("id, full_name").order("full_name").then(({ data }) => {
        if (data) setClients(data);
      });
    }
  }, [open]);

  async function handleMove(newClientId: string) {
    if (newClientId === currentClientId) { setOpen(false); return; }
    setLoading(true);
    const { error } = await supabase.from("meetings").update({ client_id: newClientId }).eq("id", meetingId);
    setLoading(false);
    if (!error) {
      router.refresh();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-brass transition">
        <FolderInput size={14} />
        Move to client
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-md card-shadow z-20 py-1 max-h-64 overflow-y-auto">
          {clients.map((c) => (
            <button key={c.id} onClick={() => handleMove(c.id)} disabled={loading}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-brass-soft transition
                ${c.id === currentClientId ? "text-brass font-medium" : "text-ink"}`}>
              {c.full_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
