import Link from "next/link";

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref }: {
  icon: any; title: string; description: string; actionLabel?: string; actionHref?: string;
}) {
  return (
    <div className="border border-dashed border-border rounded-xl py-16 px-6 text-center">
      <Icon size={24} className="text-ink-muted mx-auto mb-3" />
      <p className="text-ink font-medium mb-1">{title}</p>
      <p className="text-sm text-ink-muted mb-4 max-w-sm mx-auto">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref}
          className="inline-block bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 hover:opacity-90 transition">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
