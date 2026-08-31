"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Building2, Users } from "lucide-react";

export default function FirmsListPage() {
  const supabase = createClient();
  const [firms, setFirms] = useState<any[] | null>(null);

  useEffect(() => {
    async function load() {
      const { data: firmsData } = await supabase.from("firms").select("id, name").order("name");
      const { data: advisers } = await supabase.from("advisers").select("firm_id");
      const counts: Record<string, number> = {};
      for (const a of advisers ?? []) {
        if (!a.firm_id) continue;
        counts[a.firm_id] = (counts[a.firm_id] ?? 0) + 1;
      }
      setFirms((firmsData ?? []).map((f) => ({ ...f, adviserCount: counts[f.id] ?? 0 })));
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-paper px-6 py-16">
      <div className="max-w-lg mx-auto">
        <p className="font-display text-xl text-ink mb-6 text-center">Firms</p>

        {firms === null && <p className="text-sm text-ink-muted text-center">Loading…</p>}

        <div className="space-y-2.5">
          {firms?.map((f) => (
            <Link key={f.id} href={`/admin/firms/${f.id}`}
              className="flex items-center justify-between bg-surface border border-border rounded-xl px-5 py-4 card-shadow card-shadow-hover transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-soft flex items-center justify-center">
                  <Building2 size={15} className="text-teal" />
                </div>
                <span className="text-sm text-ink font-medium">{f.name}</span>
              </div>
              <span className="flex items-center gap-1.5 font-mono text-xs text-ink-muted">
                <Users size={12} /> {f.adviserCount}
              </span>
            </Link>
          ))}
        </div>

        <Link href="/admin" className="block text-center text-xs text-ink-muted hover:text-teal transition mt-8">
          ← Back to admin
        </Link>
      </div>
    </div>
  );
}
