"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Square, UploadCloud, FileAudio, Loader2, RotateCw, Monitor } from "lucide-react";
import Link from "next/link";
import { withRetry } from "@/lib/retry";
import { useToast } from "../ToastProvider";

function pickSupportedMimeType() {
  const preferred = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  for (const type of preferred) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

export default function RecordPage() {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("");
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();

  // Warn before closing the tab or reloading while actively recording
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (recording) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [recording]);

  function handleBackClick(e: React.MouseEvent) {
    if (recording) {
      const ok = confirm("You're still recording — leaving now will lose this recording. Continue?");
      if (!ok) e.preventDefault();
    }
  }

  async function startRecording() {
    setStatus("");
    setFile(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks.current = [];
    const mimeType = pickSupportedMimeType();
    mimeTypeRef.current = mimeType;
    const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mr.ondataavailable = (e) => chunks.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks.current, { type: mimeType || "audio/webm" });
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
async function startMeetingRecording() {
  setStatus("");
  setFile(null);
  try {
  const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const displayAudioTracks = displayStream.getAudioTracks();
    if (displayAudioTracks.length === 0) {
      displayStream.getTracks().forEach((t) => t.stop());
      micStream.getTracks().forEach((t) => t.stop());
      setStatus('No meeting audio was shared — in the share dialog, make sure "Share tab audio" (or "Share system audio") is checked, then try again.');
      return;
    }

    // We only need the audio — drop the video track immediately
    displayStream.getVideoTracks().forEach((t) => t.stop());

    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();
    audioCtx.createMediaStreamSource(micStream).connect(destination);
    audioCtx.createMediaStreamSource(new MediaStream(displayAudioTracks)).connect(destination);

    const mixedStream = destination.stream;
    chunks.current = [];
    const mimeType = pickSupportedMimeType();
    mimeTypeRef.current = mimeType;
    const mr = mimeType ? new MediaRecorder(mixedStream, { mimeType }) : new MediaRecorder(mixedStream);
    mr.ondataavailable = (e) => chunks.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks.current, { type: mimeType || "audio/webm" });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      micStream.getTracks().forEach((t) => t.stop());
      displayStream.getTracks().forEach((t) => t.stop());
      audioCtx.close();
    };

    // If they click Chrome's own "Stop sharing" bar instead of our button
    displayAudioTracks[0].addEventListener("ended", () => {
      if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") stopRecording();
    });

    mr.start();
    mediaRecorder.current = mr;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  } catch (err: any) {
    if (err?.name === "NotAllowedError") {
      setStatus("Screen/tab share was cancelled — click again and choose the meeting tab to record it.");
    } else {
      setStatus("Couldn't start meeting recording: " + err.message);
    }
  }
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

  function handleFileChoose(f: File | null) {
    setFile(f);
    setAudioBlob(null);
    setAudioUrl("");
  }

  function extForMime(mime: string) {
    if (mime.includes("mp4")) return "m4a";
    if (mime.includes("webm")) return "webm";
    return "audio";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sourceBlob: Blob | File | null = audioBlob ?? file;
    if (!sourceBlob) return;
    setLoading(true);
    setFailed(false);
    setProgress(0);

    try {
      setStatus("Getting user...");
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) { setStatus("Auth error: " + (userErr?.message ?? "no user")); setLoading(false); setFailed(true); return; }

      setStatus("Creating client record...");
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .insert({ full_name: clientName, email: clientEmail.trim() || null, adviser_id: user.id })
        .select()
        .single();
      if (clientErr) { setStatus("Client insert error: " + clientErr.message); setLoading(false); setFailed(true); return; }

      setStatus(audioBlob ? "Uploading recording..." : "Uploading file...");
      const fileName = file ? file.name : `recording.${extForMime(mimeTypeRef.current)}`;
      const filePath = `${client.id}/${Date.now()}-${fileName}`;

      let progressTimer = setInterval(() => {
        setProgress((p) => (p < 90 ? p + Math.random() * 8 : p));
      }, 300);

      try {
        await withRetry(
          async () => {
            const { error } = await supabase.storage.from("recordings").upload(filePath, sourceBlob);
            if (error) throw error;
          },
          { retries: 3, onRetry: (attempt) => setStatus(`Connection issue — retrying upload (attempt ${attempt + 1} of 3)...`) }
        );
      } catch (uploadErr: any) {
        clearInterval(progressTimer);
        setStatus("Upload failed after retries: " + uploadErr.message + " — check your connection and try again.");
        setLoading(false);
        setFailed(true);
        return;
      }
      clearInterval(progressTimer);
      setProgress(100);

      setStatus("Generating access link...");
      const { data: signedData, error: signErr } = await supabase.storage
        .from("recordings")
        .createSignedUrl(filePath, 3600);
      if (signErr || !signedData) { setStatus("Signed URL error: " + (signErr?.message ?? "unknown")); setLoading(false); setFailed(true); return; }

      setStatus("Creating meeting record...");
      const { data: meeting, error: meetingErr } = await supabase
        .from("meetings")
        .insert({ client_id: client.id, adviser_id: user.id, media_url: signedData.signedUrl })
        .select()
        .single();
      if (meetingErr) { setStatus("Meeting insert error: " + meetingErr.message); setLoading(false); setFailed(true); return; }

      setStatus("Processing (transcription + AI — can take a few minutes for longer recordings)...");
      const res = await fetch("/api/process-meeting", {
        method: "POST",
        body: JSON.stringify({ meetingId: meeting.id }),
      });

      if (res.ok) {
        toast(`${clientName}'s meeting is ready`);
        router.push(`/dashboard/meetings/${meeting.id}`);
      } else {
        const body = await res.text();
        setStatus("Processing failed: " + body);
        toast("Processing failed", "error");
        setLoading(false);
        setFailed(true);
      }
    } catch (err: any) {
      setStatus("Unexpected error: " + err.message);
      setLoading(false);
      setFailed(true);
    }
  }

  const hasSource = !!(audioBlob || file);

  return (
    <main className="max-w-md mx-auto px-8 py-16">
      <Link href="/dashboard" onClick={handleBackClick} className="text-ink-muted hover:text-teal transition inline-flex items-center gap-1.5 text-sm mb-6">
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="bg-surface border border-border rounded-xl p-8 card-shadow">
        <div className="w-11 h-11 rounded-full bg-teal-soft flex items-center justify-center mb-5">
          <Mic size={20} className="text-teal" strokeWidth={2} />
        </div>
        <h1 className="font-display text-2xl text-ink mb-1">New meeting</h1>
        <p className="text-ink-muted text-sm mb-6">Record live, or upload a file — whichever's easier right now.</p>

        <div className="space-y-3 mb-6">
          <input placeholder="Client name" required value={clientName}
            onChange={(e) => setClientName(e.target.value)} disabled={loading}
            className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition disabled:opacity-60" />
          <input placeholder="Client email (optional)" type="email" value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)} disabled={loading}
            className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition disabled:opacity-60" />
        </div>

        <div className="flex flex-col items-center gap-3 mb-5">
          {!recording && !audioUrl && (
  <div className="flex gap-3">
    <button type="button" onClick={startRecording} disabled={loading}
      className="flex flex-col items-center gap-1.5 disabled:opacity-40">
      <span className="w-14 h-14 rounded-full bg-warn text-paper flex items-center justify-center hover:opacity-90 transition">
        <Mic size={20} />
      </span>
      <span className="text-xs text-ink-muted">Mic only</span>
    </button>
    <button type="button" onClick={startMeetingRecording} disabled={loading}
      className="flex flex-col items-center gap-1.5 disabled:opacity-40">
      <span className="w-14 h-14 rounded-full bg-teal text-paper flex items-center justify-center hover:opacity-90 transition">
        <Monitor size={20} />
      </span>
      <span className="text-xs text-ink-muted">Record Zoom/Teams</span>
    </button>
  </div>
)}
          {recording && (
            <>
              <button type="button" onClick={stopRecording}
                className="w-14 h-14 rounded-full bg-ink text-paper flex items-center justify-center hover:opacity-90 transition animate-pulse">
                <Square size={18} />
              </button>
              <p className="font-mono text-sm text-warn">{formatTime(seconds)} · Recording…</p>
            </>
          )}
          {audioUrl && !recording && (
            <div className="w-full space-y-1.5">
              <audio src={audioUrl} controls className="w-full" />
              <button type="button" onClick={() => { setAudioBlob(null); setAudioUrl(""); }} disabled={loading}
                className="text-xs text-ink-muted hover:text-warn transition">
                Discard and re-record
              </button>
            </div>
          )}
          {!recording && !audioUrl && <p className="text-xs text-ink-muted">Tap to start recording</p>}
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-ink-muted">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <label className={`flex items-center gap-3 border border-dashed border-border rounded-md px-3.5 py-3 transition mb-6
          ${loading || recording ? "opacity-50" : "cursor-pointer hover:border-teal"}`}>
          <FileAudio size={18} className="text-ink-muted flex-shrink-0" />
          <span className="text-sm text-ink-muted truncate">{file ? file.name : "Choose an audio or video file"}</span>
          <input type="file" accept="audio/*,video/*" disabled={loading || recording}
            onChange={(e) => handleFileChoose(e.target.files?.[0] ?? null)}
            className="hidden" />
        </label>

        <form onSubmit={handleSubmit}>
          <button type="submit" disabled={loading || !hasSource || !clientName}
            className="bg-teal text-paper text-sm font-medium rounded-md px-3 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />}
            {failed && !loading && <RotateCw size={14} />}
            {loading ? "Processing…" : failed ? "Retry" : "Upload & process"}
          </button>

          {loading && progress > 0 && progress < 100 && (
            <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mt-3">
              <div className="h-full bg-teal transition-all duration-300 ease-out" style={{ width: `${Math.min(progress, 95)}%` }} />
            </div>
          )}

          {status && (
            <p className="font-mono text-xs text-ink-muted break-all pt-2 flex items-start gap-1.5">
              {loading && <Loader2 size={11} className="animate-spin flex-shrink-0 mt-0.5" />}
              <span>{status}</span>
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
