"use client";
import { useState, useEffect, useRef } from "react";
import { Play, Loader2 } from "lucide-react";

export function MeetingAudioPlayer({ meetingId }: { meetingId: string }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetch("/api/media-url", { method: "POST", body: JSON.stringify({ meetingId }) })
      .then((res) => res.json())
      .then((data) => {
        setLoading(false);
        if (data.url) setUrl(data.url);
        else setError(data.error ?? "No recording available");
      })
      .catch((e) => { setLoading(false); setError(e.message); });
  }, [meetingId]);

  // Listen for global "jump to timestamp" events fired by timeline components
  useEffect(() => {
    function handleJump(e: any) {
      const seconds = e.detail?.seconds;
      if (audioRef.current && typeof seconds === "number") {
        audioRef.current.currentTime = seconds;
        audioRef.current.play();
        audioRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    window.addEventListener("jump-to-timestamp", handleJump);
    return () => window.removeEventListener("jump-to-timestamp", handleJump);
  }, []);

  if (loading) return (
    <div className="bg-surface border border-border rounded-xl p-5 card-shadow flex items-center gap-2 text-sm text-ink-muted">
      <Loader2 size={14} className="animate-spin" /> Loading recording…
    </div>
  );

  if (error || !url) return (
    <div className="bg-warn-soft border border-warn/20 rounded-xl p-5 text-sm text-warn">
      {error || "Recording unavailable."}
    </div>
  );

  return (
    <div id="meeting-audio-player" className="bg-surface border border-border rounded-xl p-5 card-shadow">
      <audio ref={audioRef} src={url} controls className="w-full" />
    </div>
  );
}

// Helper any other component can import to trigger a jump
export function timeStringToSeconds(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export function jumpToTimestamp(timeStr: string) {
  const seconds = timeStringToSeconds(timeStr);
  window.dispatchEvent(new CustomEvent("jump-to-timestamp", { detail: { seconds } }));
}
