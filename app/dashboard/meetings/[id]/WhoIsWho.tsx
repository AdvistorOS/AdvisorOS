"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, Check, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/app/dashboard/ToastProvider";
import { extractSpeakerClip } from "@/lib/speaker-audio";

type Attendee = { id: string; contact_id: string; speaker_label: string | null; contacts: { full_name: string } };

export function WhoIsWho({ meetingId }: { meetingId: string }) {
  const supabase = createClient();
  const toast = useToast();
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [autoMatched, setAutoMatched] = useState<Record<string, string>>({}); // speaker -> confidence
  const [saving, setSaving] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    async function load() {
      const { data: meeting } = await supabase.from("meetings").select("client_id").eq("id", meetingId).single();
      if (meeting?.client_id) setClientId(meeting.client_id);

      const { data: transcript } = await supabase.from("transcripts").select("utterances").eq("meeting_id", meetingId).order("id", { ascending: false }).limit(1).maybeSingle();
      const utterances = (transcript?.utterances as any[]) ?? [];
      const uniqueSpeakers = Array.from(new Set(utterances.map((u) => u.speaker))).filter(Boolean).sort();
      setSpeakers(uniqueSpeakers);

      const { data: att } = await supabase
        .from("meeting_attendees")
        .select("id, contact_id, speaker_label, contacts(full_name)")
        .eq("meeting_id", meetingId);
      setAttendees((att as any) ?? []);

      const initialMapping: Record<string, string> = {};
      for (const a of (att as any) ?? []) {
        if (a.speaker_label) initialMapping[a.speaker_label] = a.contact_id;
      }
      setMapping(initialMapping);
      setLoaded(true);
    }
    load();
  }, [meetingId]);

  async function handleAutoIdentify() {
    setIdentifying(true);
    try {
      const { data: meeting } = await supabase.from("meetings").select("media_path, media_url").eq("id", meetingId).single();
      let audioUrl = meeting?.media_url;
      if (meeting?.media_path) {
        const res = await fetch("/api/media-url", { method: "POST", body: JSON.stringify({ meetingId }) });
        const data = await res.json();
        audioUrl = data.url;
      }
      if (!audioUrl) { toast("No recording available to identify from", "error"); setIdentifying(false); return; }

      const { data: transcript } = await supabase.from("transcripts").select("utterances").eq("meeting_id", meetingId).order("id", { ascending: false }).limit(1).maybeSingle();
      const utterances = (transcript?.utterances as any[]) ?? [];

      let matchedCount = 0;
      for (const speaker of speakers) {
        if (mapping[speaker]) continue; // already mapped, skip
        const clip = await extractSpeakerClip(audioUrl, utterances, speaker);
        if (!clip) continue;

        const formData = new FormData();
        formData.append("clientId", clientId);
        formData.append("audio", clip, "clip.wav");
        const res = await fetch("/api/voice/identify", { method: "POST", body: formData });
        const data = await res.json();
        if (data.match) {
          setMapping((prev) => ({ ...prev, [speaker]: data.match.contactId }));
          setAutoMatched((prev) => ({ ...prev, [speaker]: data.match.confidence }));
          matchedCount++;
        }
      }
      toast(matchedCount > 0 ? `Identified ${matchedCount} speaker${matchedCount !== 1 ? "s" : ""} — please confirm below` : "No confident matches found — enroll voices first, or map manually");
    } catch (e: any) {
      toast("Identification failed: " + e.message, "error");
    }
    setIdentifying(false);
  }

  async function handleSave() {
    setSaving(true);
    for (const [speakerLabel, contactId] of Object.entries(mapping)) {
      if (!contactId) continue;
      await supabase.from("meeting_attendees").update({ speaker_label: speakerLabel })
        .eq("meeting_id", meetingId).eq("contact_id", contactId);
    }
    setSaving(false);
    toast("Speaker mapping saved");

    fetch("/api/analyze-contacts", {
      method: "POST",
      body: JSON.stringify({ meetingId }),
    }).catch(() => {});
    toast("Building contact profiles…");
  }

  if (!loaded || speakers.length === 0 || attendees.length === 0) return null;

  const allMapped = speakers.every((s) => mapping[s]);

  return (
    <section className="bg-surface border border-border rounded-xl p-6 card-shadow">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-teal" />
          <p className="font-mono text-xs text-teal uppercase tracking-widest">Who's who</p>
        </div>
        <button onClick={handleAutoIdentify} disabled={identifying}
          className="flex items-center gap-1.5 bg-teal-soft text-teal text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-80 transition disabled:opacity-50">
          {identifying ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {identifying ? "Identifying…" : "Auto-identify"}
        </button>
      </div>
      <p className="text-xs text-ink-muted mb-4">Match each detected speaker to who they actually are — or let voice recognition suggest it, then confirm below.</p>

      <div className="space-y-2.5 mb-4">
        {speakers.map((speaker) => (
          <div key={speaker} className="flex items-center gap-3">
            <span className="text-xs font-mono text-ink-muted w-24 flex-shrink-0">Speaker {speaker}</span>
            <select value={mapping[speaker] ?? ""} onChange={(e) => setMapping((prev) => ({ ...prev, [speaker]: e.target.value }))}
              className="border border-border rounded-md px-3 py-2 text-sm bg-paper text-ink flex-1 focus:outline-none focus:border-teal">
              <option value="">Select who this is…</option>
              {attendees.map((a) => (
                <option key={a.contact_id} value={a.contact_id}>{a.contacts?.full_name}</option>
              ))}
            </select>
            {autoMatched[speaker] && (
              <span className="text-[10px] font-mono text-good bg-good-soft px-1.5 py-0.5 rounded-full whitespace-nowrap">
                {autoMatched[speaker]} match
              </span>
            )}
          </div>
        ))}
      </div>

      <button onClick={handleSave} disabled={saving || !allMapped}
        className="flex items-center justify-center gap-2 bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
        {saving ? "Saving…" : "Confirm and build profiles"}
      </button>
    </section>
  );
}
