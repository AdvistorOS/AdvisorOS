export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-lg px-5 py-4 card-shadow">
          <div className="h-3.5 bg-border rounded w-1/3 mb-2" />
          <div className="h-2.5 bg-border rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
