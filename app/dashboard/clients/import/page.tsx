"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UploadCloud, FileText } from "lucide-react";
import { useToast } from "../../ToastProvider";

export default function ImportClientsPage() {
  const supabase = createClient();
  const toast = useToast();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ name: string; email: string }[]>([]);
  const [importing, setImporting] = useState(false);

  function handleFile(f: File | null) {
    setFile(f);
    setPreview([]);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const rows = lines.slice(1).map((line) => {
        const [name, email] = line.split(",").map((v) => v?.trim().replace(/^"|"$/g, ""));
        return { name: name ?? "", email: email ?? "" };
      }).filter((r) => r.name);
      setPreview(rows.map((r) => ({ name: r.name, email: r.email })));
    };
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!preview.length) return;
    setImporting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImporting(false); return; }

    let successCount = 0;
    for (const row of preview) {
      const { error } = await supabase.from("clients").insert({
        full_name: row.name,
        email: row.email.trim() || null,
        adviser_id: user.id,
      });
      if (!error) successCount++;
    }

    setImporting(false);
    toast(`${successCount} of ${preview.length} clients imported`);
    router.push("/dashboard/clients");
  }

  return (
    <main className="max-w-md mx-auto px-8 py-16">
      <Link href="/dashboard/clients" className="text-ink-muted hover:text-teal transition inline-flex items-center gap-1.5 text-sm mb-6">
        <ArrowLeft size={16} /> Back
      </Link>
      <div className="bg-surface border border-border rounded-xl p-8 card-shadow">
        <div className="w-11 h-11 rounded-full bg-teal-soft flex items-center justify-center mb-5">
          <UploadCloud size={20} className="text-teal" strokeWidth={2} />
        </div>
        <h1 className="font-display text-2xl text-ink mb-1">Import clients</h1>
        <p className="text-ink-muted text-sm mb-6">
          Upload a CSV with two columns: <span className="font-mono text-xs">name, email</span> (email optional). First row should be a header.
        </p>

        <label className="flex items-center gap-3 border border-dashed border-border rounded-md px-3.5 py-3 cursor-pointer hover:border-teal transition mb-4">
          <FileText size={18} className="text-ink-muted flex-shrink-0" />
          <span className="text-sm text-ink-muted truncate">{file ? file.name : "Choose a CSV file"}</span>
          <input type="file" accept=".csv" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} className="hidden" />
        </label>

        {preview.length > 0 && (
          <div className="bg-paper border border-border rounded-md p-3 mb-4 max-h-48 overflow-y-auto">
            <p className="text-xs text-ink-muted mb-2">{preview.length} client{preview.length !== 1 ? "s" : ""} found:</p>
            {preview.map((r, i) => (
              <p key={i} className="text-xs text-ink">{r.name}{r.email ? ` — ${r.email}` : ""}</p>
            ))}
          </div>
        )}

        <button onClick={handleImport} disabled={importing || !preview.length}
          className="bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
          {importing ? "Importing…" : `Import ${preview.length || ""} client${preview.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </main>
  );
}
