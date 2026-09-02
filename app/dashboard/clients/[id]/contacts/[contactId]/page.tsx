import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, User, Heart, Target, AlertCircle, ListChecks, Quote } from "lucide-react";

export default async function ContactProfilePage({ params }: { params: Promise<{ id: string; contactId: string }> }) {
  const { id, contactId } = await params;
  const supabase = await createClient();

  const { data: contact } = await supabase.from("contacts").select("*").eq("id", contactId).single();
  const { data: profile } = await supabase.from("contact_profiles").select("*")
    .eq("contact_id", contactId).eq("category", "profile").is("superseded_by", null).maybeSingle();
  const { data: meetingCount } = await supabase.from("meeting_attendees").select("id", { count: "exact", head: true }).eq("contact_id", contactId);

  const data = profile?.data ?? {};

  return (
    <main className="max-w-2xl mx-auto px-8 py-10 space-y-6">
      <Link href={`/dashboard/clients/${id}`} className="text-ink-muted hover:text-teal transition flex items-center gap-1.5 text-sm">
        <ArrowLeft size={16} /> Back to client
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-teal-soft flex items-center justify-center">
          <User size={20} className="text-teal" />
        </div>
        <div>
          <h1 className="font-display text-2xl text-ink">{contact?.full_name}</h1>
          <p className="text-xs text-ink-muted">{contact?.email ?? "No email on file"}{contact?.phone ? ` · ${contact.phone}` : ""}</p>
        </div>
      </div>

      {!profile && (
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <User size={22} className="text-ink-muted mx-auto mb-3" />
          <p className="text-sm text-ink-muted">No profile yet — this builds automatically once a meeting they attended is analyzed via "Who's who".</p>
        </div>
      )}

      {profile && (
        <>
          {data.emotional_tone && (
            <section className="bg-surface border border-border rounded-xl p-5 card-shadow flex items-center gap-3">
              <Heart size={16} className="text-brass flex-shrink-0" />
              <div>
                <p className="text-xs text-ink-muted">Recent tone</p>
                <p className="text-ink font-medium capitalize">{data.emotional_tone}</p>
              </div>
            </section>
          )}

          {data.motives?.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Target size={15} className="text-teal" />
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Motives</p>
              </div>
              <div className="space-y-2">
                {data.motives.map((m: string, i: number) => (
                  <div key={i} className="bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-ink card-shadow">{m}</div>
                ))}
              </div>
            </section>
          )}

          {data.concerns?.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={15} className="text-warn" />
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Concerns</p>
              </div>
              <div className="space-y-2">
                {data.concerns.map((c: string, i: number) => (
                  <div key={i} className="bg-warn-soft border border-warn/20 rounded-lg px-4 py-2.5 text-sm text-ink">{c}</div>
                ))}
              </div>
            </section>
          )}

          {data.follow_ups?.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <ListChecks size={15} className="text-good" />
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Follow-ups</p>
              </div>
              <div className="space-y-2">
                {data.follow_ups.map((f: string, i: number) => (
                  <div key={i} className="bg-good-soft border border-good/20 rounded-lg px-4 py-2.5 text-sm text-ink">{f}</div>
                ))}
              </div>
            </section>
          )}

          {data.notable_quotes?.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Quote size={15} className="text-ink-muted" />
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">Notable quotes</p>
              </div>
              <div className="space-y-2">
                {data.notable_quotes.map((q: string, i: number) => (
                  <p key={i} className="text-sm text-ink italic bg-surface border border-border rounded-lg px-4 py-2.5 card-shadow">"{q}"</p>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
