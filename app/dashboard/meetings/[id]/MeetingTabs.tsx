"use client";
import { useState } from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "analysis", label: "Analysis" },
  { id: "people", label: "People" },
  { id: "transcript", label: "Transcript" },
];

export function MeetingTabs({ overview, analysis, people, transcript }: {
  overview: React.ReactNode; analysis: React.ReactNode; people: React.ReactNode; transcript: React.ReactNode;
}) {
  const [active, setActive] = useState("overview");
  const content: Record<string, React.ReactNode> = { overview, analysis, people, transcript };

  return (
    <>
      <div className="flex gap-1 border-b border-border sticky top-16 md:top-0 bg-paper z-10 overflow-x-auto pt-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActive(t.id)}
            className={`px-4 py-2.5 whitespace-nowrap text-sm transition border-b-2 -mb-px
              ${active === t.id ? "border-teal text-ink font-medium" : "border-transparent text-ink-muted hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-6 pt-2">{content[active]}</div>
    </>
  );
}
