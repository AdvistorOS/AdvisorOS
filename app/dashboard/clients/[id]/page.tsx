import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ClientRecord({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).single();
  const { data: clientFacts } = await supabase.from("client_facts").select("*").eq("client_id", id).is("superseded_by", null);
  const { data: actions } = await supabase.from("actions").select("*").eq("client_id", id).eq("status", "open");

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border px-8 py-5 flex items-center gap-4">
        <Link href="/dashboard" className="text-ink-muted hover:text-teal transition flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} /> Back
        </Link>
        <span className="font-display text-xl text-ink ml-2">AdvisorOS</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <h1 className="font-display text-3xl text-ink">{client?.full_name}</h1>

        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Client record</p>
          {!clientFacts?.length && <p className="text-sm text-ink-muted">No confirmed facts yet.</p>}
          <div className="space-y-2.5">
            {clientFacts?.map((f: any) => (
              <div key={f.id} className="bg-surface border border-border rounded-lg p-4 card-shadow">
                <p className="text-xs text-ink-muted">{f.data.label}</p>
                <p className="font-display text-lg text-ink">{f.data.value}</p>
              </div>
            ))}
          </div>
        </section>

        {actions && actions.length > 0 && (
          <section>
            <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Open actions</p>
            <div className="space-y-2">
              {actions.map((a: any) => (
                <div key={a.id} className="bg-surface border border-border rounded-lg px-4 py-3 text-sm text-ink flex justify-between">
                  <span>{a.description}</span>
                  <span className="font-mono text-xs text-ink-muted">{a.owner}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
