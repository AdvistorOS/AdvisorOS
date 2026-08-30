import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { User } from "lucide-react";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("*").order("full_name");

  return (
    <main className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="font-display text-3xl text-ink mb-1">Clients</h1>
      <p className="text-ink-muted text-sm mb-8">{clients?.length ?? 0} client{clients?.length !== 1 ? "s" : ""} on file.</p>

      <div className="grid md:grid-cols-2 gap-3">
        {clients?.map((c) => (
          <Link key={c.id} href={`/dashboard/clients/${c.id}`}
            className="flex items-center gap-3 bg-surface border border-border rounded-xl px-5 py-4 card-shadow card-shadow-hover transition">
            <div className="w-9 h-9 rounded-full bg-teal-soft flex items-center justify-center flex-shrink-0">
              <User size={15} className="text-teal" />
            </div>
            <p className="text-ink font-medium text-sm">{c.full_name}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
