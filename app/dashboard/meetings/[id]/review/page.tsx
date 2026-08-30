"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Edit3, Check, AlertTriangle, Eye, EyeOff, RefreshCw } from "lucide-react";

type Field = { key: string; category: string; label: string; value: string; evidence: string; confidence: "high" | "medium" | "low"; change_note?: string };
type FieldState = { field: Field; status: "pending" | "accepted" | "rejected" };

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-good-soft text-good",
  medium: "bg-brass-soft text-brass",
  low: "bg-warn-soft text-warn",
};

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [meeting, setMeeting] = useState<any>(null);
  const [facts, setFacts] = useState<any>(null);
  const [editedSummary, setEditedSummary] = useState("");
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: m } = await supabase.from("meetings").select("*, clients(id, full_name)").eq("id", id).single();
      const { data: f } = await supabase.from("extracted_facts").select("*").eq("meeting_id", id).single();
      setMeeting(m);
      setFacts(f);
      setEditedSummary(m?.client_summary ?? "");

      const initial: Record<string, FieldState> = {};
      for (const field of f?.payload?.fields ?? []) {
        initial[field.key] = { field, status: "pending" };
      }
      setFieldStates(initial);
      setLoading(false);
    }
    load();
  }, [id]);

  function setStatus(key: string, status: "accepted" | "rejected") {
    setFieldStates((prev) => ({ ...prev, [key]: { ...prev[key], status } }));
  }

  function toggleEvidence(key: string) {
    setExpandedEvidence((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function startEdit(key: string) {
    setEditingKey(key);
    setEditingValue(fieldStates[key].field.value);
  }

  function saveEdit(key: string) {
    setFieldStates((prev) => ({
      ...prev,
      [key]: { field: { ...prev[key].field, value: editingValue }, status: "accepted" },
    }));
    setEditingKey(null);
  }

  async function handleApprove() {
    setSaving(true);
    const clientId = meeting?.clients?.id;
    let factsAdded = 0, objectivesAdded = 0, riskUpdated = false;

    for (const fs of Object.values(fieldStates)) {
      if (fs.status === "rejected") continue;
      const { field } = fs;

      const { data: previous } = await supabase
        .from("client_facts").select("id")
        .eq("client_id", clientId).eq("category", field.category).is("superseded_by", null).maybeSingle();

      const { data: newFact } = await supabase
        .from("client_facts")
        .insert({ client_id: clientId, category: field.category, data: field, source_meeting_id: id })
        .select().single();

      if (previous && newFact) {
        await supabase.from("client_facts").update({ superseded_by: newFact.id }).eq("id", previous.id);
      }
      factsAdded++;
      if (field.category === "objectives") objectivesAdded++;
      if (field.category === "attitude_to_risk" || field.category === "capacity_for_loss") riskUpdated = true;
    }

    let actionsCreated = 0;
    for (const a of facts?.payload?.action_items ?? []) {
      await supabase.from("actions").insert({
        client_id: clientId, meeting_id: id, description: a.description, owner: a.owner ?? "adviser",
      });
      actionsCreated++;
    }

    await supabase.from("meetings").update({ client_summary: editedSummary }).eq("id", id);
    await supabase.from("extracted_facts").update({ reviewed: true }).eq("id", facts.id);

    const missing = facts?.payload?.attention_items?.length ?? 0;
    setSaving(false);
    router.push(
      `/dashboard/meetings/${id}/approved?facts=${factsAdded}&objectives=${objectivesAdded}&risk=${riskUpdated ? 1 : 0}&actions=${actionsCreated}&missing=${missing}&clientId=${clientId}`
    );
  }

  if (loading) return <div className="min-h-screen bg-paper flex items-center justify-center text-ink-muted text-sm">Loading…</div>;

  const attentionItems = facts?.payload?.attention_items ?? [];

  return (
    <main className="max-w-2xl mx-auto px-8 py-10 space-y-8">
      <Link href={`/dashboard/meetings/${id}`} className="text-ink-muted hover:text-teal transition flex items-center gap-1.5 text-sm">
        <ArrowLeft size={16} /> Back
      </Link>

      <div>
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Reviewing meeting</p>
        <h1 className="font-display text-3xl text-ink mt-1">{meeting?.clients?.full_name}</h1>
      </div>

      <section className="bg-surface border border-border rounded-xl p-7 card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <Edit3 size={16} className="text-teal" />
          <p className="font-mono text-xs text-teal uppercase tracking-widest">Client summary</p>
        </div>
        <textarea value={editedSummary} onChange={(e) => setEditedSummary(e.target.value)} rows={6}
          className="w-full border border-border rounded-md p-4 text-sm text-ink leading-relaxed bg-paper focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition" />
      </section>

      <section>
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Extracted client information</p>
        <div className="space-y-3">
          {Object.entries(fieldStates).map(([key, fs]) => (
            <div key={key} className={`bg-surface border rounded-xl p-5 card-shadow transition
              ${fs.status === "accepted" ? "border-good/30" : fs.status === "rejected" ? "border-warn/30 opacity-50" : "border-border"}`}>
              <div className="flex items-start justify-between gap-4 mb-2">
                <p className="text-sm text-ink-muted">{fs.field.label}</p>
                <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${CONFIDENCE_STYLE[fs.field.confidence]}`}>
                  {fs.field.confidence} confidence
                </span>
              </div>

              {editingKey === key ? (
                <div className="flex gap-2 mb-2">
                  <input value={editingValue} onChange={(e) => setEditingValue(e.target.value)}
                    className="flex-1 border border-teal rounded-md px-3 py-1.5 text-lg font-display text-ink bg-paper focus:outline-none" />
                  <button onClick={() => saveEdit(key)} className="px-3 rounded-md bg-teal text-paper hover:opacity-90 transition">
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <p className="font-display text-xl text-ink mb-2">{fs.field.value}</p>
              )}

              {fs.field.change_note && (
                <p className="flex items-center gap-1.5 text-xs text-brass mb-2">
                  <RefreshCw size={11} /> Updated — {fs.field.change_note}
                </p>
              )}

              <button onClick={() => toggleEvidence(key)} className="flex items-center gap-1 text-xs text-ink-muted hover:text-teal transition mb-3">
                {expandedEvidence.has(key) ? <EyeOff size={12} /> : <Eye size={12} />}
                {expandedEvidence.has(key) ? "Hide evidence" : "View evidence"}
              </button>
              {expandedEvidence.has(key) && (
                <p className="text-xs text-ink-muted italic bg-paper border border-border rounded-md p-3 mb-3">"{fs.field.evidence}"</p>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStatus(key, "accepted")}
                  className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-md transition ${fs.status === "accepted" ? "bg-good text-paper" : "bg-good-soft text-good hover:opacity-80"}`}>
                  <CheckCircle2 size={13} /> Accept
                </button>
                <button onClick={() => startEdit(key)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-brass-soft text-brass hover:opacity-80 transition">
                  <Edit3 size={13} /> Edit
                </button>
                <button onClick={() => setStatus(key, "rejected")}
                  className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-md transition ${fs.status === "rejected" ? "bg-warn text-paper" : "bg-warn-soft text-warn hover:opacity-80"}`}>
                  <XCircle size={13} /> Reject
                </button>
              </div>
            </div>
          ))}
          {Object.keys(fieldStates).length === 0 && (
            <p className="text-sm text-ink-muted">Nothing new to review — this meeting didn't add any new information beyond what's already on file.</p>
          )}
        </div>
      </section>

      {attentionItems.length > 0 && (
        <section className="bg-warn-soft border border-warn/20 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-warn" />
            <p className="text-sm font-medium text-ink">Information requiring attention</p>
          </div>
          <div className="space-y-4">
            {attentionItems.map((item: any, i: number) => (
              <div key={i}>
                <p className="text-sm text-ink font-medium">{item.title} — <span className="text-warn">{item.status}</span></p>
                <p className="text-xs text-ink-muted mt-0.5">{item.description}</p>
              </div>
            ))}
          </div>
          <p className="font-mono text-xs text-warn mt-4">{attentionItems.length} item{attentionItems.length !== 1 ? "s" : ""} require adviser review</p>
        </section>
      )}

      <button onClick={handleApprove} disabled={saving}
        className="bg-teal text-paper text-sm font-medium rounded-md px-4 py-3 w-full hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
        <CheckCircle2 size={16} />
        {saving ? "Saving…" : "Approve meeting"}
      </button>
      <p className="text-xs text-ink-muted text-center">Rejected items won't be added to the client record.</p>
    </main>
  );
}
