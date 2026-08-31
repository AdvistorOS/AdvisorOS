import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <p className="font-display text-2xl text-ink mb-1">Page not found</p>
        <p className="text-sm text-ink-muted mb-6">This page doesn't exist, or has moved.</p>
        <Link href="/dashboard"
          className="inline-block bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 hover:opacity-90 transition">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
