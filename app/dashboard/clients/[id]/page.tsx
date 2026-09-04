import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, Clock3, StickyNote, Users, User } from "lucide-react";
import { DeleteClientButton } from "./DeleteClientButton";
import { AskClientAI } from "./AskClientAI";
import { ClientOverview } from "./ClientOverview";
import { AccountTimeline } from "./AccountTimeline";
import { AccountSignals } from "./AccountSignals";
import { ClientAnalytics } from "./ClientAnalytics";
import { RelationshipMemory } from "./RelationshipMemory";
import { RelationshipInsights } from "./RelationshipInsights";
import { ClientTabs } from "./ClientTabs";

export default async function ClientRecord({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).single();
  const { data: actions } = await supabase.from("actions").select("*").eq("client_id", id).eq("status", "open");
  const { data: meetings } = await supabase.from("meetings")
    .select("id, created_at, status, title, objective").eq("client_id", id).order("created_at", { ascending: false });
  const { count: noteCount } = await supabase.from("client_notes").select("*", { count: "exact", head: true }).eq("client_id", id);
  const { data: contacts } = await supabase.from("contacts").select("*").eq("client_id", id).order("full_name");

  const { data: attendance } = await supabase
    .from("meeting_attendees").select("contact_id")
    .in("contact_id", (contacts ?? []).map((c) => c.id).length ? (contacts ?? []).map((c) => c.id) : ["00000000-0000-0000-0000-000000000000"]);
  const meetingCounts: Record<string, number> = {};
  for (const a of attendance ?? []) {
    if (a.contact_id) meetingCounts[a.contact_id] = (meetingCounts[a.contact_id] ?? 0) + 1;
  }

  const overviewTab = (
    <>
      <AccountSignals clientId={id} />
      <ClientOverview clientId={id} />
      {actions && actions.length > 0 && (
        <section>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Open actions</p>
          <div className="space-y-2">
            {actions.map((a: any) => (
              <div key={a.id} className="bg-surface border border-border rounded-lg px-4 py-3 text-sm text-ink flex justify-between card-shadow">
                <span>{a.description}</span>
                <span className="font-mono text-xs text-ink-muted">{a.owner}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );

  const timelineTab = <AccountTimeline clientId={id} />;

  const peopleTab = (
    <>
      {(!contacts || contacts.length === 0) && (
        <div className="border border-dashed border-border rounded-xl py-12 text-center">
          <Users size={20} className="text-ink-muted mx-auto mb-2" />
          <p className="text-sm text-ink-muted">No contacts yet. Add attendees when creating a meeting.</p>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-2.5">
        {(contacts ?? []).map((c: any) => (
          <Link key={c.id} href={`/dashboard/clients/${id}/contacts/${c.id}`}
            className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow card-shadow-hover transition">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-full bg-teal-soft flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-teal" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-ink truncate font-medium">{c.full_name}</p>
                {c.title && <p className="text-xs text-ink-muted truncate">{c.title}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-ink-muted">
              {c.email && <span className="truncate">{c.email}</span>}
              <span className="ml-auto font-mono flex-shrink-0">
                {meetingCounts[c.id] ?? 0} meeting{(meetingCounts[c.id] ?? 0) !== 1 ? "s" : ""}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );

  const meetingsTab = (
    <div className="space-y-2">
      {(meetings ?? []).map((m: any) => (
        <Link key={m.id} href={`/dashboard/meetings/${m.id}`}
          className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3 card-shadow card-shadow-hover transition">
          <div>
            <p className="text-sm text-ink">{m.title || m.objective || "Meeting"}</p>
            <p className="font-mono text-xs text-ink-muted flex items-center gap-1.5">
              <Clock3 size={11} /> {new Date(m.created_at).toLocaleDateString()}
            </p>
          </div>
          <span className="font-mono text-xs text-ink-muted">{m.status}</span>
        </Link>
      ))}
      {(!meetings || meetings.length === 0) && (
        <p className="text-sm text-ink-muted">No meetings recorded yet.</p>
      )}
    </div>
  );

  const intelligenceTab = (
    <>
      <RelationshipInsights clientId={id} />
      <RelationshipMemory clientId={id} />
      <ClientAnalytics clientId={id} />
    </>
  );

  const askTab = <AskClientAI clientId={id} />;

  return (
    <main className="max-w-2xl mx-auto px-8 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/clients" className="text-ink-muted hover:text-teal transition flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} /> Back
        </Link>
        <DeleteClientButton clientId={id} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">{client?.full_name}</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            {meetings?.length ?? 0} meeting{(meetings?.length ?? 0) !== 1 ? "s" : ""} · {contacts?.length ?? 0} contact{(contacts?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href={`/dashboard/clients/${id}/notes`}
          className="flex items-center gap-1.5 bg-surface border border-border rounded-md px-3.5 py-2 text-xs text-ink hover:bg-teal-soft hover:border-teal transition card-shadow">
          <StickyNote size={13} className="text-teal" />
          Notes {noteCount ? `(${noteCount})` : ""}
        </Link>
      </div>

      <ClientTabs
        overview={overviewTab}
        timeline={timelineTab}
        people={peopleTab}
        meetings={meetingsTab}
        intelligence={intelligenceTab}
        ask={askTab}
      />
    </main>
  );
}
