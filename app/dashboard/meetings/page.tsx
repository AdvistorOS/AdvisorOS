"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Plus, Clock3 } from "lucide-react";
import { Skeleton } from "../Skeleton";

export default function MeetingsPage() {
  const supabase = createClient();
  const [meetings, setMeetings] = useState<any[] | null>(null);

  useEffect(() => {
    supabase.from("meetings").select("*, clients(full_name), extracted_facts(payload, reviewed)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setMeetings(data ?? []));
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Meetings</h1>
          <p className="text-ink-muted text-sm mt-0.5">All client conversations, in one place.</p>
        </div>
        <Link href="/dashboard/record"
          className="bg-teal text-paper text-sm px-4 py-2.5 rounded-md hover:opacity-90 transition flex items-center gap-2 card-shadow">
          <Plus size={16} /> New meeting
        </Link>
      </div>

      {meetings === null && <Skeleton rows={5} />}
      {meetings !== null && !meetings.length && <p className="text-sm text-ink-muted">No meetings yet.</p>}

      <div className="space-y-2.5">
        {meetings?.map((m: any) => {
          const facts = m.extracted_facts?.[0];
          const factCount = facts?.payload?.fields?.length ?? 0;
          const reviewed = facts?.reviewed;
          const statusLabel = m.status === "failed" ? "Failed" : m.status !== "done" ? "Processing" : reviewed ? "Approved" : "Needs review";
          const statusStyle =
            statusLabel === "Approved" ? "bg-good-soft text-good" :
            statusLabel === "Failed" ? "bg-warn-soft text-warn" :
            statusLabel === "Needs review" ? "bg-warn-soft text-warn" : "bg-brass-soft text-brass";
          return (
            <Link key={m.id} href={`/dashboard/meetings/${m.id}`}
              className="flex items-center justify-between bg-surface border border-border rounded-xl px-5 py-4 card-shadow card-shadow-hover transition">
              <div>
                <p className="text-ink font-medium text-sm">{m.clients?.full_name}</p>
                <p className="font-mono text-xs text-ink-muted flex items-center gap-1.5 mt-1">
                  <Clock3 size={11} /> {new Date(m.created_at).toLocaleDateString()} · {factCount} facts extracted
                </p>
              </div>
              <span className={`font-mono text-xs px-2.5 py-1 rounded-full ${statusStyle}`}>{statusLabel}</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
