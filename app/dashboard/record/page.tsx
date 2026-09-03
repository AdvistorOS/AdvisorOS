"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Square, UploadCloud, FileAudio, Loader2, RotateCw, Plus, X, Check, Monitor, FileText } from "lucide-react";
import Link from "next/link";
import { withRetry } from "@/lib/retry";

type Attendee = { name: string; email: string; phone: string };
type RecordMode = "mic" | "system";

export default function RecordPage() {
  const [clientName, setClientName] = useState("");
  const [objective, setObjective] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientMatches, setClientMatches] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeName, setAttendeeName] = useState("");
  const [attendeeEmail, setAttendeeEmail] = useState("");
  const [attendeePhone, setAttendeePhone] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordMode, setRecordMode] = useState<RecordMode | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordError, setRecordError] = useState("");
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("");
  const activeStreamsRef = useRef<MediaStream[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (!clientName.trim() || selectedClientId) { setClientMatches([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("clients").select("id, full_name")
        .ilike("full_name", `%${clientName.trim()}%`).limit(5);
      setClientMatches(data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [clientName, selectedClientId]);

  function selectExistingClient(c: { id: string; full_name: string }) {
    setSelectedClientId(c.id);
    setClientName(c.full_name);
    setClientMatches([]);
  }

  function handleClientNameChange(v: string) {
    setClientName(v);
    setSelectedClientId(null);
  }

  function addAttendee() {
    if (!attendeeName.trim()) return;
    setAttendees((prev) => [...prev, { name: attendeeName.trim(), email: attendeeEmail.trim(), phone: attendeePhone.trim() }]);
    setAttendeeName("");
    setAttendeeEmail("");
    setAttendeePhone("");
  }

  function removeAttendee(i: number) {
    setAttendees((prev) => prev.filter((_, idx) => idx !== i));
  }

  function pickSupportedMimeType() {
    const preferred = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
    for (const type of preferred) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) return type;
    }
    return "";
  }

  function stopAllStreams() {
    activeStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    activeStreamsRef.current = [];
    audioContextRef.current?.close();
    audioContextRef.current = null;
  }

  async function startMicRecording() {
    setStatus("");
    setFile(null);
    setDocxFile(null);
    setRecordError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamsRef.current = [stream];
      beginRecordingFrom(stream, "mic");
    } catch (e: any) {
      setRecordError("Couldn't access microphone: " + e.message);
    }
  }

  async function startSystemRecording() {
    setStatus("");
    setFile(null);
    setDocxFile(null);
    setRecordError("");
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const systemAudioTracks = displayStream.getAudioTracks();
      if (!systemAudioTracks.length) {
        displayStream.getTracks().forEach((t) => t.stop());
        setRecordError("No audio was shared — when the share prompt appears, make sure to tick 'Share tab audio' (Chrome) or 'Share audio' before confirming.");
        return;
      }

      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        // Mic is optional here — system audio alone still works if mic access is denied
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();

      const systemSource = audioContext.createMediaStreamSource(new MediaStream(systemAudioTracks));
      systemSource.connect(destination);

      if (micStream) {
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);
      }

      activeStreamsRef.current = micStream ? [displayStream, micStream] : [displayStream];
      displayStream.getVideoTracks().forEach((t) => t.stop());

      beginRecordingFrom(destination.stream, "system");
    } catch (e: any) {
      setRecordError("Couldn't start screen/tab audio capture: " + e.message);
    }
  }

  function beginRecordingFrom(stream: MediaStream, mode: RecordMode) {
    chunks.current = [];
    const mimeType = pickSupportedMimeType();
    mimeTypeRef.current = mimeType;
    const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mr.ondataavailable = (e) => chunks.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks.current, { type: mimeType || "audio/webm" });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      stopAllStreams();
    };
    mr.start();
    mediaRecorder.current = mr;
    setRecording(true);
    setRecordMode(mode);
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

  function handleFileChoose(f: File | null) {
    setFile(f);
    setDocxFile(null);
    setAudioBlob(null);
    setAudioUrl("");
  }

  function handleDocxChoose(f: File | null) {
    setDocxFile(f);
    setFile(null);
    setAudioBlob(null);
    setAudioUrl("");
  }

  function extForMime(mime: string) {
    if (mime.includes("mp4")) return "m4a";
    if (mime.includes("webm")) return "webm";
    return "audio";
  }

  async function resolveClientAndAttendees(user: any) {
    let clientId = selectedClientId;
    if (!clientId) {
      const { data: existing } = await supabase.from("clients").select("id")
        .ilike("full_name", clientName.trim()).maybeSingle();
      if (existing) {
        clientId = existing.id;
      } else {
        const { data: newClient, error: clientErr } = await supabase
          .from("clients")
          .insert({ full_name: clientName.trim(), email: clientEmail.trim() || null, adviser_id: user.id })
          .select().single();
        if (clientErr) throw new Error("Client insert error: " + clientErr.message);
        clientId = newClient.id;
      }
    }

    const attendeeContactIds: string[] = [];
    for (const a of attendees) {
      const { data: existingContact } = await supabase.from("contacts").select("id")
        .eq("client_id", clientId).ilike("full_name", a.name).maybeSingle();
      if (existingContact) {
        attendeeContactIds.push(existingContact.id);
      } else {
        const { data: newContact } = await supabase.from("contacts")
          .insert({ client_id: clientId, full_name: a.name, email: a.email || null, phone: a.phone || null })
          .select().single();
        if (newContact) attendeeContactIds.push(newContact.id);
      }
    }

    return { clientId, attendeeContactIds };
  }

  async function handleDocxSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!docxFile) return;
    setLoading(true);
    setFailed(false);

    try {
      setStatus("Getting user...");
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) { setStatus("Auth error: " + (userErr?.message ?? "no user")); setLoading(false); setFailed(true); return; }

      const { clientId, attendeeContactIds } = await resolveClientAndAttendees(user);

      setStatus("Reading document...");
      const formData = new FormData();
      formData.append("file", docxFile);
      const extractRes = await fetch("/api/extract-docx", { method: "POST", body: formData });
      const extractData = await extractRes.json();
      if (!extractRes.ok) { setStatus("Document error: " + extractData.error); setLoading(false); setFailed(true); return; }

      setStatus("Creating meeting record...");
      const { data: meeting, error: meetingErr } = await supabase
        .from("meetings")
        .insert({ client_id: clientId, adviser_id: user.id, source_type: "transcript", objective: objective.trim() || null, status: "transcribing" })
        .select().single();
      if (meetingErr) { setStatus("Meeting insert error: " + meetingErr.message); setLoading(false); setFailed(true); return; }

      if (attendeeContactIds.length) {
        await supabase.from("meeting_attendees").insert(
          attendeeContactIds.map((contact_id) => ({ meeting_id: meeting.id, contact_id }))
        );
      }

      setStatus("Submitted — analysing transcript...");
      const res = await fetch("/api/process-transcript", {
        method: "POST",
        body: JSON.stringify({ meetingId: meeting.id, transcriptText: extractData.text }),
      });

      if (res.ok) {
        router.push(`/dashboard/meetings/${meeting.id}`);
      } else {
        const body = await res.text();
        setStatus("Processing failed: " + body);
        setLoading(false);
        setFailed(true);
      }
    } catch (err: any) {
      setStatus("Unexpected error: " + err.message);
      setLoading(false);
      setFailed(true);
    }
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

      const { clientId, attendeeContactIds } = await resolveClientAndAttendees(user);

      setStatus(audioBlob ? "Uploading recording..." : "Uploading file...");
      const fileName = file ? file.name : `recording.${extForMime(mimeTypeRef.current)}`;
      const filePath = `${clientId}/${Date.now()}-${fileName}`;

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
        setStatus("Upload failed after retries: " + uploadErr.message);
        setLoading(false);
        setFailed(true);
        return;
      }
      clearInterval(progressTimer);
      setProgress(100);

      setStatus("Generating access link...");
      const { data: signedData, error: signErr } = await supabase.storage
        .from("recordings").createSignedUrl(filePath, 3600);
      if (signErr || !signedData) { setStatus("Signed URL error: " + (signErr?.message ?? "unknown")); setLoading(false); setFailed(true); return; }

      setStatus("Creating meeting record...");
      const { data: meeting, error: meetingErr } = await supabase
        .from("meetings")
        .insert({ client_id: clientId, adviser_id: user.id, media_url: signedData.signedUrl, media_path: filePath, source_type: "audio", objective: objective.trim() || null })
        .select().single();
      if (meetingErr) { setStatus("Meeting insert error: " + meetingErr.message); setLoading(false); setFailed(true); return; }

      if (attendeeContactIds.length) {
        await supabase.from("meeting_attendees").insert(
          attendeeContactIds.map((contact_id) => ({ meeting_id: meeting.id, contact_id }))
        );
      }

      setStatus("Submitted — processing in the background. This page will update automatically, even for long recordings.");
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
        setFailed(true);
      }
    } catch (err: any) {
      setStatus("Unexpected error: " + err.message);
      setLoading(false);
      setFailed(true);
    }
  }

  const hasAudioSource = !!(audioBlob || file);

  return (
    <main className="max-w-md mx-auto px-8 py-16">
      <Link href="/dashboard" className="text-ink-muted hover:text-teal transition inline-flex items-center gap-1.5 text-sm mb-6">
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="bg-surface border border-border rounded-xl p-8 card-shadow">
        <div className="w-11 h-11 rounded-full bg-teal-soft flex items-center justify-center mb-5">
          <Mic size={20} className="text-teal" strokeWidth={2} />
        </div>
        <h1 className="font-display text-2xl text-ink mb-1">New meeting</h1>
        <p className="text-ink-muted text-sm mb-6">Record live, upload a file, or upload a written transcript.</p>

        <div className="space-y-1 mb-2 relative">
          <input placeholder="Client / company name" required value={clientName}
            onChange={(e) => handleClientNameChange(e.target.value)} disabled={loading}
            className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition disabled:opacity-60" />
          {selectedClientId && (
            <p className="text-xs text-good flex items-center gap-1"><Check size={11} /> Using existing client</p>
          )}
          {clientMatches.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 bg-surface border border-border rounded-md card-shadow mt-1 overflow-hidden">
              {clientMatches.map((c) => (
                <button key={c.id} type="button" onClick={() => selectExistingClient(c)}
                  className="block w-full text-left px-3.5 py-2 text-sm text-ink hover:bg-teal-soft transition">
                  {c.full_name} <span className="text-xs text-ink-muted">— use existing</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input placeholder="Client email (optional)" type="email" value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)} disabled={loading || !!selectedClientId}
          className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition disabled:opacity-60 mb-4" />

        <div className="mb-4">
          <p className="text-xs font-mono text-ink-muted uppercase tracking-widest mb-2">Meeting objective (optional)</p>
          <input placeholder="e.g. Agree commercial terms, present findings…" value={objective}
            onChange={(e) => setObjective(e.target.value)} disabled={loading}
            className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal disabled:opacity-60" />
        </div>

        <div className="mb-6">
          <p className="text-xs font-mono text-ink-muted uppercase tracking-widest mb-2">Meeting attendees (optional)</p>
          {attendees.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {attendees.map((a, i) => (
                <div key={i} className="flex items-center justify-between bg-paper border border-border rounded-md px-3 py-2 text-sm">
                  <span className="text-ink">{a.name}{a.email ? ` — ${a.email}` : ""}</span>
                  <button type="button" onClick={() => removeAttendee(i)}><X size={13} className="text-ink-muted hover:text-warn" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mb-1.5">
            <input placeholder="Name" value={attendeeName} onChange={(e) => setAttendeeName(e.target.value)} disabled={loading}
              className="border border-border rounded-md px-3 py-2 text-sm bg-paper text-ink focus:outline-none focus:border-teal disabled:opacity-60" />
            <input placeholder="Email (optional)" value={attendeeEmail} onChange={(e) => setAttendeeEmail(e.target.value)} disabled={loading}
              className="border border-border rounded-md px-3 py-2 text-sm bg-paper text-ink focus:outline-none focus:border-teal disabled:opacity-60" />
          </div>
          <div className="flex gap-2">
            <input placeholder="Phone (optional)" value={attendeePhone} onChange={(e) => setAttendeePhone(e.target.value)} disabled={loading}
              className="border border-border rounded-md px-3 py-2 text-sm bg-paper text-ink flex-1 focus:outline-none focus:border-teal disabled:opacity-60" />
            <button type="button" onClick={addAttendee} disabled={loading || !attendeeName.trim()}
              className="flex items-center gap-1 text-xs bg-teal-soft text-teal px-3 py-2 rounded-md hover:opacity-80 transition disabled:opacity-40">
              <Plus size={13} /> Add
            </button>
          </div>
        </div>

        {!docxFile && (
          <>
            <div className="flex flex-col items-center gap-3 mb-2">
              {!recording && !audioUrl && (
                <div className="flex items-center gap-6">
                  <button type="button" onClick={startMicRecording} disabled={loading}
                    className="w-14 h-14 rounded-full bg-warn text-paper flex items-center justify-center hover:opacity-90 transition disabled:opacity-40" title="Mic only">
                    <Mic size={20} />
                  </button>
                  <button type="button" onClick={startSystemRecording} disabled={loading}
                    className="w-14 h-14 rounded-full bg-teal text-paper flex items-center justify-center hover:opacity-90 transition disabled:opacity-40" title="Record Zoom/Teams">
                    <Monitor size={20} />
                  </button>
                </div>
              )}
              {!recording && !audioUrl && (
                <div className="flex items-center gap-6 text-center">
                  <p className="text-xs text-ink-muted w-14">Mic only</p>
                  <p className="text-xs text-ink-muted w-14">Record Zoom/Teams</p>
                </div>
              )}
              {recording && (
                <>
                  <button type="button" onClick={stopRecording}
                    className="w-14 h-14 rounded-full bg-ink text-paper flex items-center justify-center hover:opacity-90 transition animate-pulse">
                    <Square size={18} />
                  </button>
                  <p className="font-mono text-sm text-warn">{formatTime(seconds)} · Recording {recordMode === "system" ? "call" : "mic"}…</p>
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
              {recordError && <p className="text-xs text-warn text-center">{recordError}</p>}
            </div>

            <div className="flex items-center gap-3 mb-5 mt-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-ink-muted">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <label className={`flex items-center gap-3 border border-dashed border-border rounded-md px-3.5 py-3 transition mb-3
              ${loading || recording ? "opacity-50" : "cursor-pointer hover:border-teal"}`}>
              <FileAudio size={18} className="text-ink-muted flex-shrink-0" />
              <span className="text-sm text-ink-muted truncate">{file ? file.name : "Choose an audio or video file"}</span>
              <input type="file" accept="audio/*,video/*" disabled={loading || recording}
                onChange={(e) => handleFileChoose(e.target.files?.[0] ?? null)}
                className="hidden" />
            </label>
          </>
        )}

        {!hasAudioSource && !recording && (
          <>
            <div className="flex items-center gap-3 mb-3 mt-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-ink-muted">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <label className={`flex items-center gap-3 border border-dashed border-border rounded-md px-3.5 py-3 transition mb-2
              ${loading ? "opacity-50" : "cursor-pointer hover:border-teal"}`}>
              <FileText size={18} className="text-ink-muted flex-shrink-0" />
              <span className="text-sm text-ink-muted truncate">{docxFile ? docxFile.name : "Upload a written transcript (.docx)"}</span>
              <input type="file" accept=".docx" disabled={loading}
                onChange={(e) => handleDocxChoose(e.target.files?.[0] ?? null)}
                className="hidden" />
            </label>
            {docxFile && (
              <p className="text-xs text-brass mb-4">Transcript documents skip speaker identification, timelines, and playback — only text-based analysis (facts, scorecard, coaching, CRM) applies.</p>
            )}
          </>
        )}

        {docxFile ? (
          <form onSubmit={handleDocxSubmit} className="mt-3">
            <button type="submit" disabled={loading || !clientName}
              className="bg-teal text-paper text-sm font-medium rounded-md px-3 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 size={15} className="animate-spin" />}
              {failed && !loading && <RotateCw size={14} />}
              {loading ? "Processing…" : failed ? "Retry" : "Upload transcript & process"}
            </button>
            {status && (
              <p className="font-mono text-xs text-ink-muted break-all pt-2 flex items-start gap-1.5">
                {loading && <Loader2 size={11} className="animate-spin flex-shrink-0 mt-0.5" />}
                <span>{status}</span>
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="mt-3">
            <button type="submit" disabled={loading || !hasAudioSource || !clientName}
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
        )}
      </div>
    </main>
  );
}
