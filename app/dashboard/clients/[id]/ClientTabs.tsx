"use client";
import { useState } from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "people", label: "People" },
  { id: "meetings", label: "Meetings" },
  { id: "intelligence", label: "Intelligence" },
  { id: "ask", label: "Ask AI" },
];

export function ClientTabs({ overview, timeline, people, meetings, intelligence, ask }: {
  overview: React.ReactNode; timeline: React.ReactNode; people: React.ReactNode;
  meetings: React.ReactNode; intelligence: React.ReactNode; ask: React.ReactNode;
}) {
  const [active, setActive] = useState("overview");
  const content: Record<string, React.ReactNode> = { overview, timeline, people, meetings, intelligence, ask };

  return (
    <>
      <div className="flex gap-1 border-b border-border overflow-x-auto -mx-8 px-8">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActive(t.id)}
            className={`px-4 py-2.5 text-sm transition border-b-2 -mb-px whitespace-nowrap
              ${active === t.id ? "border-teal text-ink font-medium" : "border-transparent text-ink-muted hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-6 pt-4">{content[active]}</div>
    </>
  );
}
