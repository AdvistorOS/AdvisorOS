"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function CalendarPage() {
  const supabase = createClient();
  const [current, setCurrent] = useState(new Date());
  const [meetings, setMeetings] = useState<any[]>([]);
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [selectedClient, setSelectedClient] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [time, setTime] = useState("09:00");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: m } = await supabase.from("meetings").select("id, scheduled_at, created_at, status, clients(full_name)");
    setMeetings(m ?? []);
    const { data: c } = await supabase.from("clients").select("id, full_name").order("full_name");
    setClients(c ?? []);
  }
  useEffect(() => { load(); }, []);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function meetingsOn(day: number) {
    return meetings.filter((m) => {
      const d = m.scheduled_at ? new Date(m.scheduled_at) : new Date(m.created_at);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  function openModal(day: number) {
    setModalDate(new Date(year, month, day));
    setSelectedClient("");
    setCreatingNew(false);
    setNewClientName("");
    setNewClientEmail("");
    setTime("09:00");
  }

  async function handleSchedule() {
    if (!modalDate) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    let clientId = selectedClient;
    if (creatingNew) {
      const { data: newClient, error } = await supabase
        .from("clients")
        .insert({ full_name: newClientName, email: newClientEmail, adviser_id: user.id })
        .select().single();
      if (error || !newClient) { setSaving(false); return; }
      clientId = newClient.id;
    }
    if (!clientId) { setSaving(false); return; }

    const [h, min] = time.split(":").map(Number);
    const scheduledAt = new Date(modalDate);
    scheduledAt.setHours(h, min, 0, 0);

    await supabase.from("meetings").insert({
      client_id: clientId, adviser_id: user.id, scheduled_at: scheduledAt.toISOString(), status: "scheduled",
    });

    setSaving(false);
    setModalDate(null);
    load();
  }

  return (
    <main className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl text-ink">Calendar</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="p-2 rounded-md hover:bg-teal-soft transition">
            <ChevronLeft size={18} className="text-ink-muted" />
          </button>
          <p className="font-display text-lg text-ink w-40 text-center">{MONTHS[month]} {year}</p>
          <button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="p-2 rounded-md hover:bg-teal-soft transition">
            <ChevronRight size={18} className="text-ink-muted" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {DAYS.map((d) => <p key={d} className="font-mono text-xs text-ink-muted text-center">{d}</p>)}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((day, i) => (
          <div key={i} className={`min-h-24 rounded-lg border p-2 ${day ? "bg-surface border-border card-shadow" : "border-transparent"}`}>
            {day && (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs text-ink-muted">{day}</span>
                  <button onClick={() => openModal(day)} className="text-ink-muted hover:text-teal transition">
                    <Plus size={13} />
                  </button>
                </div>
                <div className="space-y-1">
                  {meetingsOn(day).slice(0, 2).map((m) => (
                    <Link key={m.id} href={m.status === "scheduled" ? "/dashboard/calendar" : `/dashboard/meetings/${m.id}`}
                      className="block text-[10px] bg-teal-soft text-teal rounded px-1.5 py-0.5 truncate hover:opacity-80 transition">
                      {m.clients?.full_name}
                    </Link>
                  ))}
                  {meetingsOn(day).length > 2 && (
                    <p className="text-[10px] text-ink-muted">+{meetingsOn(day).length - 2} more</p>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {modalDate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-6" onClick={() => setModalDate(null)}>
          <div className="bg-surface border border-border rounded-xl p-6 card-shadow max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-lg text-ink">
                {modalDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <button onClick={() => setModalDate(null)}><X size={18} className="text-ink-muted" /></button>
            </div>

            {!creatingNew ? (
              <>
                <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}
                  className="border border-border rounded-md px-3 py-2.5 w-full bg-paper text-ink text-sm mb-2 focus:outline-none focus:border-teal">
                  <option value="">Select client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
                <button onClick={() => setCreatingNew(true)} className="text-xs text-teal hover:underline mb-3">
                  + Add a new client instead
                </button>
              </>
            ) : (
              <div className="space-y-2 mb-3">
                <input placeholder="Client name" value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                  className="border border-border rounded-md px-3 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
                <input placeholder="Client email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)}
                  className="border border-border rounded-md px-3 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
                <button onClick={() => setCreatingNew(false)} className="text-xs text-ink-muted hover:underline">
                  ← Choose existing client instead
                </button>
              </div>
            )}

            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="border border-border rounded-md px-3 py-2.5 w-full bg-paper text-ink text-sm mb-4 focus:outline-none focus:border-teal" />

            <button onClick={handleSchedule} disabled={saving}
              className="bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
              {saving ? "Scheduling…" : "Schedule meeting"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
