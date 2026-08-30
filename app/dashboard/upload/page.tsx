"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ArrowLeft, UploadCloud, FileAudio } from "lucide-react";
import Link from "next/link";

export default function UploadPage() {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);

    try {
      setStatus("Getting user...");
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) { setStatus("Auth error: " + (userErr?.message ?? "no user")); setLoading(false); return; }

      setStatus("Creating client record...");
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .insert({ full_name: clientName, email: clientEmail, adviser_id: user.id })
        .select()
        .single();
      if (clientErr) { setStatus("Client insert error: " + clientErr.message); setLoading(false); return; }

      setStatus("Uploading file...");
      const filePath = `${client.id}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("recordings").upload(filePath, file);
      if (uploadErr) { setStatus("Storage upload error: " + uploadErr.message); setLoading(false); return; }

      setStatus("Generating access link...");
      const { data: signedData, error: signErr } = await supabase.storage
        .from("recordings")
        .createSignedUrl(filePath, 3600);
      if (signErr || !signedData) { setStatus("Signed URL error: " + (signErr?.message ?? "unknown")); setLoading(false); return; }

      setStatus("Creating meeting record...");
      const { data: meeting, error: meetingErr } = await supabase
        .from("meetings")
        .insert({ client_id: client.id, adviser_id: user.id, media_url: signedData.signedUrl })
        .select()
        .single();
      if (meetingErr) { setStatus("Meeting insert error: " + meetingErr.message); setLoading(false); return; }

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
        setLoading(false);
      }
    } catch (err: any) {
      setStatus("Unexpected error: " + err.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border px-8 py-5 flex items-center gap-4">
        <Link href="/dashboard" className="text-ink-muted hover:text-brass transition">
          <ArrowLeft size={18} />
        </Link>
        <span className="font-display text-xl text-ink">AdvisorOS</span>
      </header>
      <main className="max-w-md mx-auto px-6 py-16">
        <div className="bg-surface border border-border rounded-xl p-8 card-shadow">
          <div className="w-11 h-11 rounded-full bg-brass-soft flex items-center justify-center mb-5">
            <UploadCloud size={20} className="text-brass" strokeWidth={2} />
          </div>
          <h1 className="font-display text-2xl text-ink mb-1">New meeting</h1>
          <p className="text-ink-muted text-sm mb-7">Upload a recording to generate a transcript and structured notes.</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input placeholder="Client name" required value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition" />
            <input placeholder="Client email" type="email" required value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition" />

            <label className="flex items-center gap-3 border border-dashed border-border rounded-md px-3.5 py-3 cursor-pointer hover:border-brass transition">
              <FileAudio size={18} className="text-ink-muted flex-shrink-0" />
              <span className="text-sm text-ink-muted truncate">{file ? file.name : "Choose an audio or video file"}</span>
              <input type="file" accept="audio/*,video/*" required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden" />
            </label>

            <button type="submit" disabled={loading}
              className="bg-ink text-paper text-sm font-medium rounded-md px-3 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50 mt-2">
              {loading ? "Processing…" : "Upload & process"}
            </button>
            {status && <p className="font-mono text-xs text-ink-muted break-all pt-1">{status}</p>}
          </form>
        </div>
      </main>
    </div>
  );
}
