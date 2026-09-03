"use client";
import { useState } from "react";
import { ChevronDown, Lightbulb } from "lucide-react";

function scoreColor(s: number) {
  if (s >= 8) return "text-good";
  if (s >= 6) return "text-ink";
  if (s >= 4) return "text-brass";
  return "text-warn";
}

export function Scorecard({ scorecard }: { scorecard: Record<string, { score: number; reason: string; improve?: string }> }) {
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
              className={`bg-surface border rounded-lg px-4 py-3 card-shadow text-left transition
                ${isOpen ? "border-teal col-span-2" : "border-border hover:border-teal/40"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-muted capitalize">{key.replace(/_/g, " ")}</p>
                  <p className={`font-display text-xl ${scoreColor(val.score)}`}>
                    {val.score}<span className="text-xs text-ink-muted">/10</span>
                  </p>
                </div>
                <ChevronDown size={14} className={`text-ink-muted transition ${isOpen ? "rotate-180" : ""}`} />
              </div>
              {isOpen && (
                <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                  {val.reason && <p className="text-xs text-ink-muted">{val.reason}</p>}
                  {val.improve && (
                    <p className="text-xs text-teal flex items-start gap-1.5">
                      <Lightbulb size={11} className="flex-shrink-0 mt-0.5" />
                      {val.improve}
                    </p>
                  )}
                </div>
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
          {expanded === "overall" && (
            <div className="mt-2 pt-2 border-t border-paper/20 space-y-1.5">
              {overall.reason && <p className="text-xs opacity-80">{overall.reason}</p>}
              {overall.improve && <p className="text-xs opacity-90">→ {overall.improve}</p>}
            </div>
          )}
        </button>
      )}
    </div>
  );
}
