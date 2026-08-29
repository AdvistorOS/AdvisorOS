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

    try {
      setStatus("Getting user...");
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) { setStatus("Auth error: " + (userErr?.message ?? "no user")); return; }

      setStatus("Ensuring adviser record exists...");
      const { error: advErr } = await supabase
        .from("advisers")
        .upsert({ id: user.id, email: user.email, full_name: user.email }, { onConflict: "id" });
      if (advErr) { setStatus("Adviser upsert error: " + advErr.message); return; }

      setStatus("Creating client record...");
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .insert({ full_name: clientName, email: clientEmail, adviser_id: user.id })
        .select()
        .single();
      if (clientErr) { setStatus("Client insert error: " + clientErr.message); return; }

      setStatus("Uploading file...");
      const filePath = `${client.id}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("recordings").upload(filePath, file);
      if (uploadErr) { setStatus("Storage upload error: " + uploadErr.message); return; }

      const { data: urlData } = supabase.storage.from("recordings").getPublicUrl(filePath);

      setStatus("Creating meeting record...");
      const { data: meeting, error: meetingErr } = await supabase
        .from("meetings")
        .insert({ client_id: client.id, adviser_id: user.id, media_url: urlData.publicUrl })
        .select()
        .single();
      if (meetingErr) { setStatus("Meeting insert error: " + meetingErr.message); return; }

      setStatus("Processing (transcription + AI, ~1 min)...");
      const res = await fetch("/api/process-meeting", {
        method: "POST",
        body: JSON.stringify({ meetingId: meeting.id }),
      });

      if (res.ok) {
        router.push(`/dashboard/meetings/${meeting.id}`);
      } else {
        const body = await res.text();
        setStatus("Processing failed: " + body);
      }
    } catch (err: any) {
      setStatus("Unexpected error: " + err.message);
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
          {status && <p className="font-mono text-xs text-ink-muted break-all">{status}</p>}
        </form>
      </main>
    </div>
  );
}
