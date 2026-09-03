"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function Scorecard({ scorecard }: { scorecard: Record<string, { score: number; reason: string }> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const entries = Object.entries(scorecard).filter(([k]) => k !== "overall");
  const overall = scorecard.overall;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        {entries.map(([key, val]) => {
          const isOpen = expanded === key;
          return (
            <button key={key} onClick={() => setExpanded(isOpen ? null : key)}
              className="bg-surface border border-border rounded-lg px-4 py-3 card-shadow text-left hover:border-teal/40 transition col-span-2 md:col-span-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-muted capitalize">{key.replace(/_/g, " ")}</p>
                  <p className="font-display text-xl text-ink">{val.score}<span className="text-xs text-ink-muted">/10</span></p>
                </div>
                <ChevronDown size={14} className={`text-ink-muted transition ${isOpen ? "rotate-180" : ""}`} />
              </div>
              {isOpen && val.reason && (
                <p className="text-xs text-ink-muted mt-2 pt-2 border-t border-border/60">{val.reason}</p>
              )}
            </button>
          );
        })}
      </div>
      {overall && typeof overall.score === "number" && (
        <button onClick={() => setExpanded(expanded === "overall" ? null : "overall")}
          className="w-full bg-ink text-paper rounded-lg px-4 py-3 mt-2.5 text-left hover:opacity-90 transition">
          <div className="flex items-center justify-between">
            <p className="text-sm">Overall</p>
            <div className="flex items-center gap-2">
              <p className="font-display text-xl">{overall.score}<span className="text-xs opacity-70">/10</span></p>
              <ChevronDown size={14} className={`transition ${expanded === "overall" ? "rotate-180" : ""}`} />
            </div>
          </div>
          {expanded === "overall" && overall.reason && (
            <p className="text-xs opacity-80 mt-2 pt-2 border-t border-paper/20">{overall.reason}</p>
          )}
        </button>
      )}
    </div>
  );
}
