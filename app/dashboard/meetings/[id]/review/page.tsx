"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Edit3 } from "lucide-react";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [meeting, setMeeting] = useState<any>(null);
  const [facts, setFacts] = useState<any>(null);
  const [editedSummary, setEditedSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: m } = await supabase.from("meetings").select("*, clients(full_name)").eq("id", id).single();
      const { data: f } = await supabase.from("extracted_facts").select("*").eq("meeting_id", id).single();
      setMeeting(m);
      setFacts(f);
      setEditedSummary(m?.client_summary ?? "");
      setReviewed(f?.reviewed ?? false);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleApprove() {
    setSaving(true);
    await supabase.from("meetings").update({ client_summary: editedSummary }).eq("id", id);
    if (facts) {
      await supabase.from("extracted_facts").update({ reviewed: true }).eq("id", facts.id);
    }
    setSaving(false);
    router.push(`/dashboard/meetings/${id}`);
  }

  if (loading) return <div className="min-h-screen bg-paper flex items-center justify-center text-ink-muted text-sm">Loading…</div>;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border px-8 py-5 flex items-center gap-4">
        <Link href={`/dashboard/meetings/${id}`} className="text-ink-muted hover:text-teal transition flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} />
          Back
        </Link>
        <span className="font-display text-xl text-ink ml-2">AdvisorOS</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Reviewing meeting</p>
          <h1 className="font-display text-3xl text-ink mt-1">{meeting?.clients?.full_name}</h1>
          <div className="flex items-center gap-2 mt-3">
            {reviewed ? (
              <span className="flex items-center gap-1.5 text-xs text-good bg-good-soft px-2.5 py-1 rounded-full">
                <CheckCircle2 size={12} /> Already reviewed
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-warn bg-warn-soft px-2.5 py-1 rounded-full">
                <XCircle size={12} /> Not yet reviewed
              </span>
            )}
          </div>
        </div>

        <section className="bg-surface border border-border rounded-xl p-7 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Edit3 size={16} className="text-teal" />
            <p className="font-mono text-xs text-teal uppercase tracking-widest">Client summary — edit before approving</p>
          </div>
          <textarea
            value={editedSummary}
            onChange={(e) => setEditedSummary(e.target.value)}
            rows={8}
            className="w-full border border-border rounded-md p-4 text-sm text-ink leading-relaxed bg-paper focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition"
          />
        </section>

        {facts?.payload && (
          <section>
            <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Extracted facts — check for accuracy</p>
            <div className="bg-surface border border-border rounded-xl p-6 card-shadow space-y-4">
              {Object.entries(facts.payload).map(([key, value]: [string, any]) => {
                if (key === "client_sentiment" || !value || (Array.isArray(value) && value.length === 0)) return null;
                return (
                  <div key={key}>
                    <p className="text-xs font-mono text-brass uppercase tracking-wide mb-1">{key.replace(/_/g, " ")}</p>
                    <pre className="text-xs text-ink-muted whitespace-pre-wrap font-mono">{JSON.stringify(value, null, 2)}</pre>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {facts?.payload?.flags_for_adviser_review?.length > 0 && (
          <section className="bg-warn-soft border border-warn/20 rounded-xl p-6">
            <p className="text-sm font-medium text-ink mb-2">Flagged for your attention</p>
            <ul className="text-sm text-ink-muted list-disc list-inside space-y-1">
              {facts.payload.flags_for_adviser_review.map((f: string, i: number) => <li key={i}>{f}</li>)}
            </ul>
          </section>
        )}

        <button onClick={handleApprove} disabled={saving}
          className="bg-teal text-paper text-sm font-medium rounded-md px-4 py-3 w-full hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
          <CheckCircle2 size={16} />
          {saving ? "Saving…" : reviewed ? "Save changes" : "Approve and mark reviewed"}
        </button>
      </main>
    </div>
  );
}
