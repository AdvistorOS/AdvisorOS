"use client";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-warn-soft flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={20} className="text-warn" />
        </div>
        <p className="font-display text-xl text-ink mb-1">Something went wrong</p>
        <p className="text-sm text-ink-muted mb-6">We couldn’t load this page. Please try again.</p>
        <button onClick={reset}
          className="bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 hover:opacity-90 transition">
          Try again
        </button>
      </div>
    </div>
  );
}
