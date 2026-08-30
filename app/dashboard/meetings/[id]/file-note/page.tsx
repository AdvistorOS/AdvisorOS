"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, Check } from "lucide-react";

export default function FileNotePage() {
  const { id } = useParams<{ id: string }>();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/generate-file-note", { method: "POST", body: JSON.stringify({ meetingId: id }) })
      .then((r) => r.json()).then((d) => { setText(d.text); setLoading(false); });
  }, [id]);

  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border px-8 py-5 flex items-center gap-4">
        <Link href={`/dashboard/meetings/${id}`} className="text-ink-muted hover:text-teal transition flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} /> Back
        </Link>
        <span className="font-display text-xl text-ink ml-2">AdvisorOS</span>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="font-display text-2xl text-ink mb-1">File note</h1>
        <p className="text-ink-muted text-sm mb-6">Draft — review before saving to the client file.</p>
        {loading ? (
          <p className="text-ink-muted text-sm">Generating…</p>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-6 card-shadow">
            <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{text}</p>
            <button onClick={copy} className="flex items-center gap-1.5 text-xs text-teal hover:underline mt-5">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
