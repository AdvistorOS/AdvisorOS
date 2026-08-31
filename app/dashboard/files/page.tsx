"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileAudio, FileText, Upload, X } from "lucide-react";
import { LoadingDots } from "../LoadingDots";

export default function FilesPage() {
  const supabase = createClient();
  const [meetings, setMeetings] = useState<any[] | null>(null);
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedClient, setSelectedClient] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data: m } = await supabase.from("meetings").select("id, media_url, created_at, status, clients(full_name)").order("created_at", { ascending: false });
    setMeetings(m ?? []);
    const { data: c } = await supabase.from("clients").select("id, full_name").order("full_name");
    setClients(c ?? []);
  }
  useEffect(() => { load(); }, []);

  async function handleUpload() {
    if (!file || !selectedClient) return;
    setUploading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in."); setUploading(false); return; }

    const filePath = `${selectedClient}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("recordings").upload(filePath, file);
    if (uploadErr) { setError(uploadErr.message); setUploading(false); return; }

    const { data: signedData, error: signErr } = await supabase.storage.from("recordings").createSignedUrl(filePath, 3600);
    if (signErr || !signedData) { setError(signErr?.message ?? "Could not create link"); setUploading(false); return; }

    const { data: meeting, error: meetingErr } = await supabase
      .from("meetings")
      .insert({ client_id: selectedClient, adviser_id: user.id, media_url: signedData.signedUrl })
      .select().single();
    if (meetingErr) { setError(meetingErr.message); setUploading(false); return; }

    await fetch("/api/process-meeting", { method: "POST", body: JSON.stringify({ meetingId: meeting.id }) });

    setUploading(false);
    setModalOpen(false);
    setFile(null);
    setSelectedClient("");
    load();
  }

  return (
    <main className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Files</h1>
          <p className="text-ink-muted text-sm mt-0.5">Meeting recordings, grouped by client.</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="bg-teal text-paper text-sm px-4 py-2.5 rounded-md hover:opacity-90 transition flex items-center gap-2 card-shadow">
          <Upload size={16} /> Upload file
        </button>
      </div>

      {meetings === null && <LoadingDots label="Loading files…" />}
      {meetings !== null && !meetings.length && <p className="text-sm text-ink-muted">No files yet.</p>}

      <div className="space-y-2.5">
        {meetings?.map((m: any) => (
          <div key={m.id} className="flex items-center gap-3 bg-surface border border-border rounded-lg px-5 py-3.5 card-shadow">
            <FileAudio size={16} className="text-teal flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink truncate">{m.clients?.full_name ?? "Unassigned"} — recording</p>
              <p className="text-xs text-ink-muted">{new Date(m.created_at).toLocaleDateString()} · {m.status}</p>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-6" onClick={() => setModalOpen(false)}>
          <div className="bg-surface border border-border rounded-xl p-6 card-shadow max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-lg text-ink">Upload file</p>
              <button onClick={() => setModalOpen(false)}><X size={18} className="text-ink-muted" /></button>
            </div>

            <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}
              className="border border-border rounded-md px-3 py-2.5 w-full bg-paper text-ink text-sm mb-3 focus:outline-none focus:border-teal">
              <option value="">Select client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>

            <label className="flex items-center gap-3 border border-dashed border-border rounded-md px-3.5 py-3 cursor-pointer hover:border-teal transition mb-4">
              <FileText size={18} className="text-ink-muted flex-shrink-0" />
              <span className="text-sm text-ink-muted truncate">{file ? file.name : "Choose a file"}</span>
              <input type="file" accept="audio/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
            </label>

            <button onClick={handleUpload} disabled={uploading || !file || !selectedClient}
              className="bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
              {uploading ? "Uploading…" : "Upload & process"}
            </button>
            {error && <p className="text-xs text-warn mt-2">{error}</p>}
          </div>
        </div>
      )}
    </main>
  );
}
