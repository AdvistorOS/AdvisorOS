import Link from "next/link";

export function Page({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto px-5 sm:px-8 lg:px-10 py-8 lg:py-10 ${wide ? "max-w-[1400px]" : "max-w-5xl"}`}>
      {children}
    </main>
  );
}

export function PageHeader({ title, subtitle, meta, actions }: {
  title: string; subtitle?: string; meta?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pb-6 mb-6 border-b border-border">
      <div className="min-w-0">
        <h1 className="font-display text-[30px] leading-tight text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink-muted mt-1">{subtitle}</p>}
        {meta && <div className="flex items-center gap-4 mt-2.5 text-xs text-ink-subtle">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

export function Section({ title, action, children, className = "" }: {
  title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="label">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({ children, className = "", hover = false }: {
  children: React.ReactNode; className?: string; hover?: boolean;
}) {
  return (
    <div className={`bg-surface border border-border rounded-xl card-shadow ${hover ? "card-shadow-hover" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, tone = "default" }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "good" | "warn" | "brass";
}) {
  const toneCls = {
    default: "text-ink", good: "text-good", warn: "text-warn", brass: "text-brass",
  }[tone];
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 card-shadow">
      <p className="text-xs text-ink-subtle">{label}</p>
      <p className={`font-display text-2xl leading-tight mt-0.5 ${toneCls}`}>{value}</p>
      {sub && <p className="text-[11px] text-ink-subtle mt-0.5">{sub}</p>}
    </div>
  );
}

export function Chip({ children, tone = "neutral" }: {
  children: React.ReactNode; tone?: "neutral" | "teal" | "good" | "warn" | "brass";
}) {
  const cls = {
    neutral: "bg-border/50 text-ink-muted",
    teal: "bg-teal-soft text-teal",
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
    brass: "bg-brass-soft text-brass",
  }[tone];
  return <span className={`chip ${cls}`}>{children}</span>;
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="rounded-full bg-teal-soft flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}>
      <span className="font-medium text-teal" style={{ fontSize: size * 0.36 }}>{initials}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref }: {
  icon: any; title: string; description: string; actionLabel?: string; actionHref?: string;
}) {
  return (
    <div className="border border-dashed border-border rounded-xl py-14 px-6 text-center">
      <Icon size={22} className="text-ink-subtle mx-auto mb-3" />
      <p className="text-ink font-medium text-sm">{title}</p>
      <p className="text-sm text-ink-muted mt-1 max-w-sm mx-auto">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref}
          className="inline-block mt-4 bg-teal text-paper text-sm font-medium rounded-md px-4 py-2 hover:opacity-90 transition">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function Tabs({ tabs, active, onChange }: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-0.5 border-b border-border overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-3.5 py-2.5 text-sm transition border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5
            ${active === t.id
              ? "border-teal text-ink font-medium"
              : "border-transparent text-ink-muted hover:text-ink hover:border-border-strong"}`}>
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className="text-[11px] text-ink-subtle font-mono">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
