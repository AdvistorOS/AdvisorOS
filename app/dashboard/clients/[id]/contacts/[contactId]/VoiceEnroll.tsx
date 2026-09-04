"use client";
import { useState, useRef } from "react";
import { Mic, Square, Loader2, Check } from "lucide-react";
import { fileToWav16kMono } from "@/lib/audio-wav";
import { useToast } from "@/app/dashboard/ToastProvider";

export function VoiceEnroll({ contactId }: { contactId: string }) {
  const toast = useToast();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<{ status: string; remaining: number } | null>(null);
  const [error, setError] = useState("");
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function start() {
    setError("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunks.current = [];
    const mr = new MediaRecorder(stream);
    mr.ondataavailable = (e) => chunks.current.push(e.data);
    mr.onstop = handleStopped;
    mr.start();
    mediaRecorder.current = mr;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stop() {
    mediaRecorder.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function handleStopped() {
    setProcessing(true);
    try {
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      const wav = await fileToWav16kMono(blob);
      const formData = new FormData();
      formData.append("contactId", contactId);
      formData.append("audio", wav, "sample.wav");
      const res = await fetch("/api/voice/enroll", { method: "POST", body: formData });
      const data = await res.json();
      setProcessing(false);
      if (res.ok) {
        setStatus({ status: data.status, remaining: data.remainingSpeechSeconds });
        toast(data.status === "Enrolled" ? "Voice enrolled" : "Sample added — record a bit more");
      } else {
        setError(data.error ?? "Enrollment failed");
      }
    } catch (e: any) {
      setProcessing(false);
      setError(e.message);
    }
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-6 card-shadow">
      <div className="flex items-center gap-2 mb-3">
        <Mic size={15} className="text-teal" />
        <p className="font-mono text-xs text-teal uppercase tracking-widest">Voice recognition</p>
      </div>

      {status?.status === "Enrolled" ? (
        <p className="text-sm text-good flex items-center gap-1.5">
          <Check size={14} /> Voice enrolled — future meetings can auto-identify this person.
        </p>
      ) : (
        <>
          <p className="text-xs text-ink-muted mb-3">
            Record ~20-30 seconds of this person speaking naturally. You may need 2-3 short samples.
          </p>
          <div className="flex items-center gap-3">
            {!recording && (
              <button onClick={start} disabled={processing}
                className="w-11 h-11 rounded-full bg-warn text-paper flex items-center justify-center hover:opacity-90 transition disabled:opacity-40">
                <Mic size={16} />
              </button>
            )}
            {recording && (
              <button onClick={stop} className="w-11 h-11 rounded-full bg-ink text-paper flex items-center justify-center animate-pulse">
                <Square size={14} />
              </button>
            )}
            {recording && <span className="font-mono text-sm text-warn">{seconds}s</span>}
            {processing && (
              <span className="text-xs text-ink-muted flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Processing…
              </span>
            )}
          </div>
          {status && <p className="text-xs text-brass mt-2">Sample added — {status.remaining}s more needed.</p>}
          {error && <p className="text-xs text-warn mt-2">{error}</p>}
        </>
      )}
    </section>
  );
}
