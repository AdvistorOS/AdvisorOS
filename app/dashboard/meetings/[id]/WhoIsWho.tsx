"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, Check, Loader2 } from "lucide-react";
import { useToast } from "@/app/dashboard/ToastProvider";

type Attendee = { id: string; contact_id: string; speaker_label: string | null; contacts: { full_name: string } };

export function WhoIsWho({ meetingId }: { meetingId: string }) {
  const supabase = createClient();
  const toast = useToast();
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
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

  async function handleSave() {
    setSaving(true);
    for (const [speakerLabel, contactId] of Object.entries(mapping)) {
      if (!contactId) continue;
      await supabase.from("meeting_attendees").update({ speaker_label: speakerLabel })
        .eq("meeting_id", meetingId).eq("contact_id", contactId);
    }
    setSaving(false);
    toast("Speaker mapping saved");

    // Kick off per-contact profile analysis now that we know who's who
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
      <div className="flex items-center gap-2 mb-1">
        <Users size={15} className="text-teal" />
        <p className="font-mono text-xs text-teal uppercase tracking-widest">Who's who</p>
      </div>
      <p className="text-xs text-ink-muted mb-4">Match each detected speaker to who they actually are, so their profile builds correctly over time.</p>

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
