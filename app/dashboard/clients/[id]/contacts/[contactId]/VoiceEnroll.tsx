"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mic, Square, Loader2, Check, AlertCircle } from "lucide-react";
import { fileToWav16kMono } from "@/lib/audio-wav";
import { useToast } from "@/app/dashboard/ToastProvider";

export function VoiceEnroll({ contactId }: { contactId: string }) {
  const supabase = createClient();
  const toast = useToast();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState("");
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    supabase.from("voice_profiles").select("enrolled").eq("contact_id", contactId)
      .maybeSingle().then(({ data }) => { if (data?.enrolled) setEnrolled(true); });
  }, [contactId]);

  async function start() {
    setError("");
    try {
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
    } catch (e: any) {
      setError("Couldn't access microphone: " + e.message);
    }
  }

  function stop() {
    mediaRecorder.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function handleStopped() {
    setProcessing(true);
    setError("");
    try {
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      const wav = await fileToWav16kMono(blob);

      const formData = new FormData();
      formData.append("contactId", contactId);
      formData.append("audio", wav, "sample.wav");

      const res = await fetch("/api/voice/enroll", { method: "POST", body: formData });
      const data = await res.json();
      setProcessing(false);

      if (!res.ok) {
        setError(data.error ?? "Enrollment failed");
        return;
      }

      setRemaining(data.remainingSpeechSeconds);
      if (data.status === "Enrolled") {
        setEnrolled(true);
        toast("Voice enrolled");
      } else {
        toast(`Sample added — ${data.remainingSpeechSeconds}s more speech needed`);
      }
    } catch (e: any) {
      setProcessing(false);
      setError("Audio processing failed: " + e.message);
    }
  }

  return (
    <section className="bg-surface border border-border rounded-lg p-5 card-shadow">
      <div className="flex items-center gap-2 mb-3">
        <Mic size={15} className="text-teal" />
        <h2 className="label">Voice recognition</h2>
      </div>

      {enrolled ? (
        <p className="text-sm text-good flex items-center gap-1.5">
          <Check size={14} /> Enrolled — Auto-identify can now match this person in future meetings.
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-muted mb-3">
            Record this person speaking naturally. Azure needs roughly 20 seconds of clean speech in
            total — you may need two or three samples.
          </p>
          <div className="flex items-center gap-3">
            {!recording && !processing && (
              <button onClick={start}
                className="w-10 h-10 rounded-full bg-warn text-paper flex items-center justify-center hover:opacity-90 transition">
                <Mic size={16} />
              </button>
            )}
            {recording && (
              <>
                <button onClick={stop}
                  className="w-10 h-10 rounded-full bg-ink text-paper flex items-center justify-center animate-pulse">
                  <Square size={14} />
                </button>
                <span className="font-mono text-sm text-warn">{seconds}s</span>
              </>
            )}
            {processing && (
              <span className="text-sm text-ink-muted flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Processing…
              </span>
            )}
          </div>

          {remaining !== null && remaining > 0 && (
            <p className="text-sm text-brass mt-2">{remaining}s more speech needed.</p>
          )}

          {error && (
            <p className="text-sm text-warn mt-2 flex items-start gap-1.5">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
