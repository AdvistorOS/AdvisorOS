"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Square, Play } from "lucide-react";
import Link from "next/link";

export default function RecordPage() {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function startRecording() {
    setStatus("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks.current = [];
    const mr = new MediaRecorder(stream);
    mr.ondataavailable = (e) => chunks.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      stream.getTracks().forEach((t) => t.stop());
    };
    mr.start();
    mediaRecorder.current = mr;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stopRecording() {
    mediaRecorder.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!audioBlob) return;
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

      setStatus("Uploading recording...");
      const filePath = `${client.id}/${Date.now()}-recording.webm`;
      const { error: uploadErr } = await supabase.storage.from("recordings").upload(filePath, audioBlob);
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
        <Link href="/dashboard" className="text-ink-muted hover:text-teal transition">
          <ArrowLeft size={18} />
        </Link>
        <span className="font-display text-xl text-ink">AdvisorOS</span>
      </header>
      <main className="max-w-md mx-auto px-6 py-16">
        <div className="bg-surface border border-border rounded-xl p-8 card-shadow">
          <div className="w-11 h-11 rounded-full bg-teal-soft flex items-center justify-center mb-5">
            <Mic size={20} className="text-teal" strokeWidth={2} />
          </div>
          <h1 className="font-display text-2xl text-ink mb-1">Record a meeting</h1>
          <p className="text-ink-muted text-sm mb-7">Record directly in the browser — no file transfer needed.</p>

          <div className="flex flex-col items-center gap-4 mb-7">
            {!recording && !audioUrl && (
              <button onClick={startRecording}
                className="w-16 h-16 rounded-full bg-warn text-paper flex items-center justify-center hover:opacity-90 transition">
                <Mic size={22} />
              </button>
            )}
            {recording && (
              <>
                <button onClick={stopRecording}
                  className="w-16 h-16 rounded-full bg-ink text-paper flex items-center justify-center hover:opacity-90 transition animate-pulse">
                  <Square size={20} />
                </button>
                <p className="font-mono text-sm text-warn">{formatTime(seconds)} · Recording…</p>
              </>
            )}
            {audioUrl && !recording && (
              <div className="w-full space-y-2">
                <audio src={audioUrl} controls className="w-full" />
                <button onClick={() => { setAudioBlob(null); setAudioUrl(""); }}
                  className="text-xs text-ink-muted hover:text-warn transition">
                  Discard and re-record
                </button>
              </div>
            )}
          </div>

          {audioBlob && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input placeholder="Client name" required value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition" />
              <input placeholder="Client email" type="email" required value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition" />
              <button type="submit" disabled={loading}
                className="bg-teal text-paper text-sm font-medium rounded-md px-3 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
                {loading ? "Processing…" : "Upload & process"}
              </button>
              {status && <p className="font-mono text-xs text-ink-muted break-all pt-1">{status}</p>}
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
