import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, ArrowRight, Calendar, AlertCircle, CheckSquare, Users, Mic, FileText } from "lucide-react";
import { Page, PageHeader, Card, Chip, EmptyState, Avatar } from "./ui";

const STATUS: Record<string, { label: string; tone: "good" | "warn" | "teal" | "neutral" }> = {
  transcribing: { label: "Transcribing", tone: "teal" },
  extracting: { label: "Analysing", tone: "teal" },
  summarizing: { label: "Preparing insights", tone: "teal" },
  done: { label: "Ready to review", tone: "good" },
  approved: { label: "Reviewed", tone: "neutral" },
  failed: { label: "Needs a retry", tone: "warn" },
};

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const name = String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim().split(/\s+/)[0];
  const since = new Date(new Date().getTime() - 86_400_000).toISOString();
  // Fetch independent panels together; counts stay correct beyond Supabase's row limit.
  const [recent, recorded, reviews, tasks, clients, flagged] = await Promise.all([
    supabase.from("meetings").select("id, created_at, status, objective, clients(full_name)").eq("adviser_id", user.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("adviser_id", user.id).gte("created_at", since),
    supabase.from("extracted_facts").select("id, meetings!inner(adviser_id)", { count: "exact", head: true }).eq("meetings.adviser_id", user.id).eq("reviewed", false),
    supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("extracted_facts").select("id, payload, meetings!inner(id, adviser_id, clients(full_name))").eq("meetings.adviser_id", user.id).eq("reviewed", false).order("id", { ascending: false }).limit(20),
  ]);
  const unavailable = [recent, recorded, reviews, tasks, clients, flagged].some(result => result.error);
  const attention = (flagged.data ?? []).flatMap((row) => {
    const meeting = row.meetings as unknown as { id: string; clients: { full_name: string } | null };
    const items = Array.isArray(row.payload?.attention_items) ? row.payload.attention_items : [];
    return items.filter((item: { title?: unknown }) => typeof item?.title === "string").map((item: { title: string }) => ({ title: item.title, meetingId: meeting.id, client: meeting.clients?.full_name || "Client meeting" }));
  }).slice(0, 5);
  const stats = [
    { label: "Meetings recorded", caption: "In the last 24 hours", value: recorded.error ? "—" : recorded.count ?? 0, icon: Calendar, href: "/dashboard/meetings" },
    { label: "Awaiting review", caption: "Extracted meeting records", value: reviews.error ? "—" : reviews.count ?? 0, icon: AlertCircle, href: "/dashboard/meetings" },
    { label: "Open tasks", caption: "Your next steps", value: tasks.error ? "—" : tasks.count ?? 0, icon: CheckSquare, href: "/dashboard/tasks" },
    { label: "Clients", caption: "In your workspace", value: clients.error ? "—" : clients.count ?? 0, icon: Users, href: "/dashboard/clients" },
  ];
  return <Page wide>
    <p className="text-[11px] text-teal font-semibold tracking-[0.14em] uppercase mb-3">Workspace overview</p>
    <PageHeader title={name ? `Welcome back, ${name}` : "Your day, in focus"} subtitle="Review your conversations. Keep every next step moving."
      actions={<Link href="/dashboard/record" className="inline-flex items-center gap-2 bg-teal text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal/90"><Mic size={16}/> New meeting</Link>} />
    {unavailable && <p role="alert" className="mb-6 rounded-xl border border-warn/20 bg-warn-soft px-4 py-3 text-sm text-warn">Some workspace information could not load. Refresh the page to try again.</p>}
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5 mb-8">
      {stats.map(stat => <Link key={stat.label} href={stat.href} className="group bg-surface border border-border rounded-2xl p-4 sm:p-5 card-shadow card-shadow-hover">
        <div className="flex items-center justify-between mb-5"><span className="grid place-items-center w-9 h-9 bg-paper rounded-xl text-teal"><stat.icon size={18}/></span><ArrowUpRight size={15} className="text-ink-subtle group-hover:text-teal"/></div>
        <p className="font-display text-3xl tabular-nums">{stat.value}</p><p className="text-sm font-medium mt-2">{stat.label}</p><p className="text-xs text-ink-subtle mt-1">{stat.caption}</p>
      </Link>)}
    </div>
    <div className="grid xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)] gap-6 items-start">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 border-b border-border"><div><h2 className="text-base font-semibold">Recent meetings</h2><p className="text-xs text-ink-muted mt-1">From conversation to a clear record.</p></div><Link href="/dashboard/meetings" className="text-xs font-semibold text-teal flex items-center gap-1">View all <ArrowRight size={14}/></Link></div>
        {recent.error ? <p className="p-6 text-sm text-ink-muted">Meetings are temporarily unavailable.</p> : !recent.data?.length ? <div className="p-5"><EmptyState icon={Mic} title="Your first meeting starts here" description="Record a conversation or upload a transcript to create a summary and next steps." actionLabel="Add a meeting" actionHref="/dashboard/record"/></div> :
          <div className="divide-y divide-border">{recent.data.map(meeting => {
            const client = meeting.clients as unknown as { full_name: string } | null;
            const title = client?.full_name || "Client meeting";
            const status = STATUS[meeting.status] || { label: "Processing", tone: "neutral" as const };
            return <Link key={meeting.id} href={`/dashboard/meetings/${meeting.id}`} className="flex items-center gap-3 sm:gap-4 px-5 py-5 hover:bg-paper/70">
              <Avatar name={title} size={38}/><div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{title}</p><p className="text-xs text-ink-muted mt-1 truncate">{meeting.objective || "Meeting record"}</p><p className="text-[11px] text-ink-subtle mt-1.5">{new Date(meeting.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" })}</p></div><Chip tone={status.tone}>{status.label}</Chip>
            </Link>;
          })}</div>}
      </Card>
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="px-5 py-5 border-b border-border"><div className="flex items-center gap-2"><AlertCircle size={17} className="text-warn"/><h2 className="text-base font-semibold">Worth your attention</h2></div><p className="text-xs text-ink-muted mt-1.5">Suggestions from recent unreviewed records.</p></div>
          {flagged.error ? <p className="p-5 text-sm text-ink-muted">Suggestions are temporarily unavailable.</p> : !attention.length ? <div className="p-6"><CheckSquare className="text-good mb-3" size={22}/><p className="text-sm font-medium">No suggestions to review</p><p className="text-xs text-ink-muted mt-1 leading-relaxed">Points that need a closer look will appear here after analysis.</p></div> : <div className="divide-y divide-border">{attention.map((item, i) => <Link key={`${item.meetingId}-${i}`} href={`/dashboard/meetings/${item.meetingId}`} className="flex gap-3 px-5 py-4 hover:bg-paper/70"><span className="mt-1.5 w-1.5 h-1.5 bg-warn rounded-full shrink-0"/><div className="min-w-0"><p className="text-sm leading-relaxed">{item.title}</p><p className="text-xs text-ink-subtle mt-1">{item.client}</p></div><ArrowUpRight size={14} className="ml-auto shrink-0 text-ink-subtle mt-1"/></Link>)}</div>}
        </Card>
        <div className="rounded-2xl border border-teal/15 bg-teal-soft p-5"><FileText size={21} className="text-teal mb-3"/><h2 className="font-semibold text-sm">Make the record yours</h2><p className="text-sm text-ink-muted mt-2 leading-relaxed">Check the extracted facts against your conversation before adding them to the client record.</p><Link href="/dashboard/meetings" className="inline-flex items-center gap-2 text-teal text-xs font-semibold mt-4">Review meetings <ArrowRight size={14}/></Link></div>
      </div>
    </div>
  </Page>;
}
