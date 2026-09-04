import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { User, Building2 } from "lucide-react";

export default async function PeoplePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: clients } = await supabase.from("clients").select("id, full_name").eq("adviser_id", user.id);
  const clientIds = (clients ?? []).map((c) => c.id);
  const clientNameById: Record<string, string> = {};
  for (const c of clients ?? []) clientNameById[c.id] = c.full_name;

  const { data: contacts } = await supabase
    .from("contacts").select("id, full_name, email, title, client_id, participant_type")
    .in("client_id", clientIds.length ? clientIds : ["00000000-0000-0000-0000-000000000000"])
    .order("full_name");

  const { data: attendance } = await supabase
    .from("meeting_attendees").select("contact_id")
    .in("contact_id", (contacts ?? []).map((c) => c.id).length ? (contacts ?? []).map((c) => c.id) : ["00000000-0000-0000-0000-000000000000"]);

  const meetingCounts: Record<string, number> = {};
  for (const a of attendance ?? []) {
    if (a.contact_id) meetingCounts[a.contact_id] = (meetingCounts[a.contact_id] ?? 0) + 1;
  }

  const external = (contacts ?? []).filter((c) => c.participant_type !== "user" && c.participant_type !== "colleague");

  return (
    <main className="max-w-3xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink mb-1">People</h1>
        <p className="text-ink-muted text-sm">
          {external.length} contact{external.length !== 1 ? "s" : ""} across {clients?.length ?? 0} client{clients?.length !== 1 ? "s" : ""}.
        </p>
      </div>

      {external.length === 0 && (
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <User size={22} className="text-ink-muted mx-auto mb-3" />
          <p className="text-sm text-ink-muted">
            No contacts yet. Add attendees when creating a meeting and they become persistent profiles here.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-2.5">
        {external.map((c) => (
          <Link key={c.id} href={`/dashboard/clients/${c.client_id}/contacts/${c.id}`}
            className="bg-surface border border-border rounded-xl px-5 py-4 card-shadow card-shadow-hover transition">
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-9 h-9 rounded-full bg-teal-soft flex items-center justify-center flex-shrink-0">
                <User size={15} className="text-teal" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-ink font-medium truncate">{c.full_name}</p>
                {c.title && <p className="text-xs text-ink-muted truncate">{c.title}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-ink-muted">
              <span className="flex items-center gap-1 truncate">
                <Building2 size={10} /> {clientNameById[c.client_id] ?? "—"}
              </span>
              <span className="ml-auto flex-shrink-0 font-mono">
                {meetingCounts[c.id] ?? 0} meeting{(meetingCounts[c.id] ?? 0) !== 1 ? "s" : ""}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
