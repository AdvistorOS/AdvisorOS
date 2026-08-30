"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Edit3, Check, X } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  income: "Income",
  expenditure: "Expenditure",
  assets: "Assets",
  liabilities: "Liabilities",
  pensions: "Pensions",
  dependants: "Dependants",
  objectives: "Objectives",
  attitude_to_risk: "Attitude to risk",
  capacity_for_loss: "Capacity for loss",
  existing_products: "Existing products",
};

type FieldStatus = { status: "pending" | "accepted" | "rejected"; value: any };

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [meeting, setMeeting] = useState<any>(null);
  const [facts, setFacts] = useState<any>(null);
  const [editedSummary, setEditedSummary] = useState("");
  const [fieldStatuses, setFieldStatuses] = useState<Record<string, FieldStatus>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: m } = await supabase.from("meetings").select("*, clients(id, full_name)").eq("id", id).single();
      const { data: f } = await supabase.from("extracted_facts").select("*").eq("meeting_id", id).single();
      setMeeting(m);
      setFacts(f);
      setEditedSummary(m?.client_summary ?? "");

      const initial: Record<string, FieldStatus> = {};
      const savedStatus = f?.field_status ?? {};
      for (const key of Object.keys(f?.payload ?? {})) {
        if (["client_sentiment", "flags_for_adviser_review", "action_items"].includes(key)) continue;
        const value = f.payload[key];
        if (!value || (Array.isArray(value) && value.length === 0)) continue;
        initial[key] = savedStatus[key] ?? { status: "pending", value };
      }
      setFieldStatuses(initial);
      setLoading(false);
    }
    load();
  }, [id]);

  function setStatus(key: string, status: "accepted" | "rejected") {
    setFieldStatuses((prev) => ({ ...prev, [key]: { ...prev[key], status } }));
  }

  function startEdit(key: string) {
    setEditingKey(key);
    setEditingText(JSON.stringify(fieldStatuses[key].value, null, 2));
  }

  function saveEdit(key: string) {
    try {
      const parsed = JSON.parse(editingText);
      setFieldStatuses((prev) => ({ ...prev, [key]: { status: "accepted", value: parsed } }));
      setEditingKey(null);
    } catch {
      alert("That's not valid — check the format and try again.");
    }
  }

  async function handleApprove() {
    setSaving(true);
    const clientId = meeting?.clients?.id;

    for (const [category, fs] of Object.entries(fieldStatuses)) {
      if (fs.status !== "accepted" && fs.status !== "pending") continue;

      const { data: previous } = await supabase
        .from("client_facts")
        .select("id")
        .eq("client_id", clientId)
        .eq("category", category)
        .is("superseded_by", null)
        .maybeSingle();

      const { data: newFact } = await supabase
        .from("client_facts")
        .insert({ client_id: clientId, category, data: fs.value, source_meeting_id: id })
        .select()
        .single();

      if (previous && newFact) {
        await supabase.from("client_facts").update({ superseded_by: newFact.id }).eq("id", previous.id);
      }
    }

    await supabase.from("meetings").update({ client_summary: editedSummary }).eq("id", id);
    await supabase.from("extracted_facts").update({ reviewed: true, field_status: fieldStatuses }).eq("id", facts.id);

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
        </div>

        <section className="bg-surface border border-border rounded-xl p-7 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Edit3 size={16} className="text-teal" />
            <p className="font-mono text-xs text-teal uppercase tracking-widest">Client summary</p>
          </div>
          <textarea
            value={editedSummary}
            onChange={(e) => setEditedSummary(e.target.value)}
            rows={7}
            className="w-full border border-border rounded-md p-4 text-sm text-ink leading-relaxed bg-paper focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition"
          />
        </section>

        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Extracted client information — review each item</p>
          <div className="space-y-3">
            {Object.entries(fieldStatuses).map(([key, fs]) => (
              <div key={key} className={`bg-surface border rounded-xl p-5 card-shadow transition
                ${fs.status === "accepted" ? "border-good/30" : fs.status === "rejected" ? "border-warn/30 opacity-60" : "border-border"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-brass uppercase tracking-wide mb-1">{CATEGORY_LABELS[key] ?? key}</p>
                    {editingKey === key ? (
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={4}
                        className="w-full border border-teal rounded-md p-2 text-xs font-mono text-ink bg-paper focus:outline-none"
                      />
                    ) : (
                      <pre className="text-xs text-ink-muted whitespace-pre-wrap font-mono">{JSON.stringify(fs.value, null, 2)}</pre>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {editingKey === key ? (
                      <button onClick={() => saveEdit(key)} className="p-1.5 rounded-md bg-teal text-paper hover:opacity-90 transition">
                        <Check size={14} />
                      </button>
                    ) : (
                      <>
                        <button onClick={() => setStatus(key, "accepted")}
                          className={`p-1.5 rounded-md transition ${fs.status === "accepted" ? "bg-good text-paper" : "bg-good-soft text-good hover:opacity-80"}`}>
                          <CheckCircle2 size={14} />
                        </button>
                        <button onClick={() => startEdit(key)}
                          className="p-1.5 rounded-md bg-brass-soft text-brass hover:opacity-80 transition">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => setStatus(key, "rejected")}
                          className={`p-1.5 rounded-md transition ${fs.status === "rejected" ? "bg-warn text-paper" : "bg-warn-soft text-warn hover:opacity-80"}`}>
                          <XCircle size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

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
          {saving ? "Saving…" : "Approve meeting"}
        </button>
        <p className="text-xs text-ink-muted text-center">Rejected items won't be added to the client record. Everything else will be.</p>
      </main>
    </div>
  );
}
