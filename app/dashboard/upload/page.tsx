"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const supabase = createClient();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setStatus("Uploading…");

    const { data: { user } } = await supabase.auth.getUser();

    const { data: client } = await supabase
      .from("clients")
      .insert({ full_name: clientName, email: clientEmail, adviser_id: user!.id })
      .select()
      .single();

    const filePath = `${client.id}/${Date.now()}-${file.name}`;
    await supabase.storage.from("recordings").upload(filePath, file);
    const { data: urlData } = supabase.storage.from("recordings").getPublicUrl(filePath);

    const { data: meeting } = await supabase
      .from("meetings")
      .insert({ client_id: client.id, adviser_id: user!.id, media_url: urlData.publicUrl })
      .select()
      .single();

    setStatus("Processing (about a minute)…");

    const res = await fetch("/api/process-meeting", {
      method: "POST",
      body: JSON.stringify({ meetingId: meeting.id }),
    });

    if (res.ok) {
      router.push(`/dashboard/meetings/${meeting.id}`);
    } else {
      setStatus("Something went wrong — check the dashboard.");
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border px-8 py-5">
        <span className="font-display text-xl text-ink">AdvisorOS</span>
      </header>
      <main className="max-w-md mx-auto px-6 py-10">
        <h1 className="font-display text-2xl text-ink mb-8">New meeting</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input placeholder="Client name" required value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="border border-border rounded-sm px-3 py-2 w-full bg-surface text-ink focus:outline-none focus:border-brass" />
          <input placeholder="Client email" type="email" required value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            className="border border-border rounded-sm px-3 py-2 w-full bg-surface text-ink focus:outline-none focus:border-brass" />
          <input type="file" accept="audio/*,video/*" required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-ink-muted w-full" />
          <button type="submit" className="bg-ink text-paper text-sm rounded-sm px-3 py-2 w-full hover:opacity-90 transition">
            Upload & process
          </button>
          {status && <p className="font-mono text-xs text-ink-muted">{status}</p>}
        </form>
      </main>
    </div>
  );
}
