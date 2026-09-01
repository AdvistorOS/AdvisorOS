"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Building2, Users, ArrowLeft } from "lucide-react";

export default function AdminPage() {
  const [firmName, setFirmName] = useState("");
  const [practiceType, setPracticeType] = useState("wealth_management");
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleCreateFirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/create-firm", {
      method: "POST",
      body: JSON.stringify({ name: firmName, practiceType }),
    });
    const data = await res.json();
    if (res.ok) window.location.href = `/admin/firms/${data.firm.id}`;
    else setError(data.error);
  }

  return (
    <div className="min-h-screen bg-paper flex items-start justify-center px-6 py-16">
      <div className="max-w-sm w-full space-y-6">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-teal transition">
          <ArrowLeft size={13} /> Back to my dashboard
        </Link>

        <p className="font-display text-xl text-ink text-center">AdvisorOS Admin</p>

        <div className="bg-surface border border-border rounded-xl p-6 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} className="text-teal" />
            <p className="font-mono text-xs text-teal uppercase tracking-widest">New firm</p>
          </div>
          <form onSubmit={handleCreateFirm} className="space-y-3">
            <input placeholder="Firm name" required value={firmName} onChange={(e) => setFirmName(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
            <select value={practiceType} onChange={(e) => setPracticeType(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal">
              <option value="wealth_management">Wealth management / financial advice</option>
              <option value="profit_consulting">Profit / business consulting</option>
            </select>
            <button type="submit" className="bg-teal text-paper text-sm px-4 py-2.5 rounded-md w-full hover:opacity-90 transition">Create</button>
          </form>
          {error && <p className="text-warn text-xs mt-2">{error}</p>}
        </div>

        <Link href="/admin/firms"
          className="block text-center bg-surface border border-border rounded-xl p-4 text-sm text-ink hover:bg-teal-soft transition card-shadow">
          Manage firms →
        </Link>

        <Link href="/admin/advisers"
          className="flex items-center justify-center gap-2 bg-surface border border-border rounded-xl p-4 text-sm text-ink hover:bg-teal-soft transition card-shadow">
          <Users size={15} /> All advisers →
        </Link>
      </div>
    </div>
  );
}
