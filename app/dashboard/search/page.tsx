"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Search as SearchIcon, FileText, User } from "lucide-react";

export default function SearchPage() {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);

    const { data: fromTranscripts } = await supabase
      .from("transcripts")
      .select("meeting_id, full_text, meetings(id, created_at, clients(id, full_name))")
      .ilike("full_text", `%${query}%`)
      .limit(20);

    const { data: fromSummaries } = await supabase
      .from("meetings")
      .select("id, created_at, client_summary, clients(id, full_name)")
      .ilike("client_summary", `%${query}%`)
      .limit(20);

    const combined: any[] = [];
    for (const t of fromTranscripts ?? []) {
      const idx = t.full_text?.toLowerCase().indexOf(query.toLowerCase()) ?? -1;
      const snippet = idx >= 0 ? t.full_text.slice(Math.max(0, idx - 60), idx + 100) : t.full_text?.slice(0, 150);
      combined.push({
        meetingId: (t.meetings as any)?.id,
        clientId: (t.meetings as any)?.clients?.id,
        clientName: (t.meetings as any)?.clients?.full_name,
        date: (t.meetings as any)?.created_at,
        snippet,
        source: "transcript",
      });
    }
    for (const s of fromSummaries ?? []) {
      if (combined.some((c) => c.meetingId === s.id)) continue;
      const idx = s.client_summary?.toLowerCase().indexOf(query.toLowerCase()) ?? -1;
      const snippet = idx >= 0 ? s.client_summary.slice(Math.max(0, idx - 60), idx + 100) : s.client_summary?.slice(0, 150);
      combined.push({
        meetingId: s.id,
        clientId: (s.clients as any)?.id,
        clientName: (s.clients as any)?.full_name,
        date: s.created_at,
        snippet,
        source: "summary",
      });
    }

    setResults(combined);
    setLoading(false);
  }

  return (
    <main className="max-w-2xl mx-auto px-8 py-10">
      <h1 className="font-display text-3xl text-ink mb-1">Search</h1>
      <p className="text-ink-muted text-sm mb-8">Search across every transcript and meeting summary.</p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <div className="relative flex-1">
          <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. SIPP, university, retirement age…"
            className="border border-border rounded-md pl-10 pr-3.5 py-2.5 w-full bg-surface text-ink text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition" />
        </div>
        <button type="submit" disabled={loading}
          className="bg-teal text-paper text-sm px-5 rounded-md hover:opacity-90 transition disabled:opacity-50">
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {results !== null && results.length === 0 && (
        <p className="text-sm text-ink-muted">No matches found.</p>
      )}

      <div className="space-y-2.5">
        {results?.map((r, i) => (
          <Link key={i} href={`/dashboard/meetings/${r.meetingId}`}
            className="block bg-surface border border-border rounded-lg px-5 py-4 card-shadow card-shadow-hover transition">
            <div className="flex items-center gap-2 mb-1.5">
              <User size={12} className="text-teal" />
              <span className="text-sm text-ink font-medium">{r.clientName}</span>
              <span className="font-mono text-xs text-ink-muted ml-auto">{new Date(r.date).toLocaleDateString()}</span>
            </div>
            <p className="text-xs text-ink-muted flex items-start gap-1.5">
              <FileText size={11} className="flex-shrink-0 mt-0.5" />
              …{r.snippet}…
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
