"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getContrastText } from "@/lib/color-contrast";
import {
  LayoutDashboard, Calendar, CalendarDays, Sun, Mic, Users, Contact, CheckSquare, Search, GraduationCap, LineChart, UsersRound,
  Settings, User, LogOut, Menu, X,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
      { label: "Today", href: "/dashboard/today", icon: Sun },
      { label: "Search", href: "/dashboard/search", icon: Search },
    ],
  },
  {
    label: "Work",
    items: [
      { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
      { label: "Meetings", href: "/dashboard/meetings", icon: Calendar },
      { label: "New Meeting", href: "/dashboard/record", icon: Mic },
      { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
    ],
  },
  {
    label: "Relationships",
    items: [
      { label: "Clients", href: "/dashboard/clients", icon: Users },
      { label: "People", href: "/dashboard/people", icon: Contact },
    ],
  },
  {
    label: "Performance",
    items: [
      { label: "Coaching", href: "/dashboard/coaching", icon: GraduationCap },
      { label: "Analytics", href: "/dashboard/analytics", icon: LineChart },
      { label: "Team", href: "/dashboard/team", icon: UsersRound },
    ],
  },
];

export function Sidebar({ email, brandColor, brandAccent, logoUrl }: {
  email: string; brandColor?: string; brandAccent?: string; logoUrl?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const brand = /^#[0-9a-f]{6}$/i.test(brandColor ?? "") ? brandColor : "#087F73";
  const accent = /^#[0-9a-f]{6}$/i.test(brandAccent ?? "") ? brandAccent : "#087F73";
  useEffect(() => {
    const dialog = dialogRef.current;
    if (mobileOpen) { dialog?.showModal(); document.body.style.overflow = "hidden"; }
    else { dialog?.close(); document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);
  function close() { setMobileOpen(false); triggerRef.current?.focus(); }
  async function handleSignOut() {
    setSigningOut(true); setSignOutError("");
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      router.replace("/login"); router.refresh();
    } catch { setSignOutError("Unable to sign out. Please try again."); }
    finally { setSigningOut(false); }
  }
  const content = (
    <div className="flex flex-col h-full bg-surface text-ink">
      <Link href="/dashboard" onClick={close} className="flex items-center gap-3 px-6 h-20 shrink-0">
        {logoUrl ? <Image unoptimized width={36} height={36} src={logoUrl} alt="" className="h-9 w-9 object-contain rounded-xl" /> :
          <span className="w-9 h-9 rounded-xl grid place-items-center font-semibold text-lg" style={{ backgroundColor: brand, color: getContrastText(brand!) }}>A</span>}
        <span className="text-lg font-semibold tracking-tight">AdvisorOS</span>
      </Link>
      <div className="px-4 pb-5">
        <Link href="/dashboard/record" onClick={close} className="flex items-center justify-center gap-2 rounded-xl bg-teal text-white py-3 text-sm font-semibold hover:bg-teal/90"><Mic size={17} /> New meeting</Link>
      </div>
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-4 pb-5 space-y-5">
        {NAV_GROUPS.map((group, i) => <div key={group.label ?? i}>
          {group.label && <p className="px-3 mb-2 text-[11px] font-semibold tracking-wider uppercase text-ink-subtle">{group.label}</p>}
          <div className="space-y-1">{group.items.filter(item => item.href !== "/dashboard/record").map(item => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={close} aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${active ? "bg-teal-soft text-teal font-semibold" : "text-ink-muted hover:bg-paper hover:text-ink"}`}>
              <Icon size={18} strokeWidth={active ? 2 : 1.7} /><span>{item.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal" />}
            </Link>;
          })}</div>
        </div>)}
      </nav>
      <div className="border-t border-border px-4 py-4 shrink-0">
        <Link href="/dashboard/settings" onClick={close} className="flex items-center gap-3 px-3 py-2 text-sm text-ink-muted hover:text-ink"><Settings size={17} /> Workspace settings</Link>
        <div className="flex items-center gap-2 mt-3 px-2">
          <Link href="/dashboard/account" onClick={close} className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="w-8 h-8 rounded-full grid place-items-center shrink-0" style={{ backgroundColor: accent, color: getContrastText(accent!) }}><User size={15}/></span>
            <span className="text-xs truncate">{email}<span className="block text-ink-subtle mt-0.5">Your account</span></span>
          </Link>
          <button aria-label="Sign out" title="Sign out" disabled={signingOut} onClick={handleSignOut} className="p-2 text-ink-muted hover:text-warn disabled:opacity-50"><LogOut size={16}/></button>
        </div>
        {signOutError && <p role="alert" className="text-xs text-warn mt-2">{signOutError}</p>}
      </div>
    </div>
  );
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-surface focus:p-3">Skip to content</a>
    <header className="md:hidden fixed inset-x-0 top-0 h-16 z-30 bg-surface border-b border-border flex items-center gap-3 px-5">
      <button ref={triggerRef} aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-lg"><Menu size={21}/></button>
      <span className="font-semibold">AdvisorOS</span>
    </header>
    <aside className="hidden md:block w-60 lg:w-64 shrink-0 border-r border-border h-dvh sticky top-0">{content}</aside>
    <dialog ref={dialogRef} aria-label="Navigation" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}
      className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] border-0 p-0 backdrop:bg-ink/40">
      <button aria-label="Close navigation" onClick={close} className="absolute right-2 top-6 p-2 rounded-lg bg-surface"><X size={18}/></button>
      {content}
    </dialog>
  </>;
}
