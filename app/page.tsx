import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <p className="font-display text-3xl text-ink mb-2">AdvisorOS</p>
        <p className="text-ink-muted text-sm mb-12">Meeting intelligence for wealth advisers</p>

        <div className="space-y-3">
          <Link href="/login"
            className="flex items-center gap-3 bg-surface border border-border rounded-lg px-5 py-4 card-shadow card-shadow-hover transition text-left">
            <div className="w-9 h-9 rounded-full bg-brass-soft flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={16} className="text-brass" />
            </div>
            <div>
              <p className="text-ink font-medium text-sm">I'm an adviser</p>
              <p className="text-ink-muted text-xs">Access your client dashboard</p>
            </div>
          </Link>

          <Link href="/client/login"
            className="flex items-center gap-3 bg-surface border border-border rounded-lg px-5 py-4 card-shadow card-shadow-hover transition text-left">
            <div className="w-9 h-9 rounded-full bg-brass-soft flex items-center justify-center flex-shrink-0">
              <Users size={16} className="text-brass" />
            </div>
            <div>
              <p className="text-ink font-medium text-sm">I'm a client</p>
              <p className="text-ink-muted text-xs">View your meeting summaries</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
