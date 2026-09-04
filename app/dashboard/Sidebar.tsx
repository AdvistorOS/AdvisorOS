"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getContrastText, getContrastMuted } from "@/lib/color-contrast";
import {
  LayoutDashboard, Calendar, CalendarDays, Sun, PoundSterling, Mic, Users, Contact, CheckSquare, Search, GraduationCap, LineChart, UsersRound,
  Settings, User, ChevronUp, LogOut, Menu, X,
} from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Today", href: "/dashboard/today", icon: Sun },
  { label: "Search", href: "/dashboard/search", icon: Search },
  { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
  { label: "Meetings", href: "/dashboard/meetings", icon: Calendar },
  { label: "New Meeting", href: "/dashboard/record", icon: Mic },
  { label: "Clients", href: "/dashboard/clients", icon: Users },
  { label: "People", href: "/dashboard/people", icon: Contact },
  { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
  { label: "Coaching", href: "/dashboard/coaching", icon: GraduationCap },
  { label: "Overall Stats", href: "/dashboard/analytics", icon: LineChart },
  { label: "Team", href: "/dashboard/team", icon: UsersRound },
];

export function Sidebar({ email, brandColor, brandAccent, logoUrl }: {
  email: string;
  brandColor?: string;
  brandAccent?: string;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const bg = brandColor || "#0B5C52";
  const accent = brandAccent || "#C9971E";
  const text = getContrastText(bg);
  const mutedText = getContrastMuted(bg);
  const isLightBg = text === "#16241F";

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(item: typeof NAV[number]) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  const content = (
    <div className="flex flex-col h-full" style={{ backgroundColor: bg, color: text }}>
      <div className="flex items-center gap-2.5 px-5 py-5">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-8 w-auto max-w-[36px] object-contain rounded-md" />
        ) : (
          <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accent }}>
            <span className="font-display text-sm font-bold" style={{ color: getContrastText(accent) }}>A</span>
          </div>
        )}
        <span className="font-display text-lg tracking-tight" style={{ color: text }}>AdvisorOS</span>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
              style={active
                ? { backgroundColor: accent, color: getContrastText(accent) }
                : { color: mutedText }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition hover:opacity-80">
              <Icon size={17} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3 relative">
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg hover:opacity-80 transition">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accent }}>
            <User size={14} style={{ color: getContrastText(accent) }} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs truncate" style={{ color: text }}>{email}</p>
          </div>
          <ChevronUp size={14} style={{ color: mutedText }} className={`transition ${menuOpen ? "" : "rotate-180"}`} />
        </button>

        {menuOpen && (
          <div className={`absolute bottom-full left-3 right-3 mb-1 rounded-lg card-shadow py-1 z-20 border
            ${isLightBg ? "bg-surface border-border" : "bg-ink border-white/10"}`}>
            <Link href="/dashboard/account" onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 text-sm transition hover:opacity-70 ${isLightBg ? "text-ink" : "text-paper"}`}>
              <User size={14} /> Account
            </Link>
            <Link href="/dashboard/settings" onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 text-sm transition hover:opacity-70 ${isLightBg ? "text-ink" : "text-paper"}`}>
              <Settings size={14} /> Settings
            </Link>
            <button onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 text-sm text-warn hover:opacity-70 transition w-full text-left">
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

      <aside className="hidden md:flex flex-col w-60 border-r border-border h-screen sticky top-0">
        {content}
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileOpen(false)}>
          <aside className="w-60 h-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-3 p-2 z-10">
              <X size={18} style={{ color: text }} />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
