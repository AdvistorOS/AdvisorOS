"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, Calendar, CalendarDays, Mic, Users, CheckSquare, Search, GraduationCap, LineChart, UsersRound,
  Settings, User, ChevronUp, LogOut, Menu, X,
} from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Search", href: "/dashboard/search", icon: Search },
  { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
  { label: "Meetings", href: "/dashboard/meetings", icon: Calendar },
  { label: "New Meeting", href: "/dashboard/record", icon: Mic },
  { label: "Clients", href: "/dashboard/clients", icon: Users },
  { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
  { label: "Coaching", href: "/dashboard/coaching", icon: GraduationCap },
  { label: "Overall Stats", href: "/dashboard/analytics", icon: LineChart },
  { label: "Team", href: "/dashboard/team", icon: UsersRound },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(item: typeof NAV[number]) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img src="/logo-mark.svg" alt="" width={30} height={30} className="rounded-md" />
        <span className="font-display text-lg text-ink tracking-tight">AdvisorOS</span>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition
                ${active ? "bg-teal text-paper" : "text-ink-muted hover:bg-teal-soft hover:text-ink"}`}>
              <Icon size={17} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3 relative">
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg hover:bg-teal-soft transition">
          <div className="w-8 h-8 rounded-full bg-teal-soft flex items-center justify-center flex-shrink-0">
            <User size={14} className="text-teal" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs text-ink truncate">{email}</p>
          </div>
          <ChevronUp size={14} className={`text-ink-muted transition ${menuOpen ? "" : "rotate-180"}`} />
        </button>

        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-surface border border-border rounded-lg card-shadow py-1 z-20">
            <Link href="/dashboard/account" onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-teal-soft transition">
              <User size={14} /> Account
            </Link>
            <Link href="/dashboard/settings" onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-teal-soft transition">
              <Settings size={14} /> Settings
            </Link>
            <button onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 text-sm text-warn hover:bg-warn-soft transition w-full text-left">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-30 bg-surface border border-border rounded-md p-2 card-shadow">
        <Menu size={18} className="text-ink" />
      </button>

      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-surface h-screen sticky top-0">
        {content}
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileOpen(false)}>
          <aside className="w-60 h-full bg-surface" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-3 p-2">
              <X size={18} className="text-ink" />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
