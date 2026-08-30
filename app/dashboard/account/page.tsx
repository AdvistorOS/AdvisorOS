import { createClient } from "@/lib/supabase/server";
import { User } from "lucide-react";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meetings } = await supabase.from("meetings").select("id, created_at");
  const thisMonth = (meetings ?? []).filter((m) => new Date(m.created_at).getMonth() === new Date().getMonth()).length;

  return (
    <main className="max-w-2xl mx-auto px-8 py-10">
      <h1 className="font-display text-3xl text-ink mb-8">Account</h1>

      <div className="bg-surface border border-border rounded-xl p-6 card-shadow flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-teal-soft flex items-center justify-center">
          <User size={22} className="text-teal" />
        </div>
        <div>
          <p className="text-ink font-medium">{user?.email}</p>
          <p className="text-xs text-ink-muted">Adviser</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 card-shadow mb-6">
        <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-4">Usage this month</p>
        <p className="text-sm text-ink">Meetings processed: <span className="font-medium">{thisMonth}</span></p>
      </div>

      <div className="border border-warn/30 rounded-xl p-6 bg-warn-soft">
        <p className="text-sm font-medium text-warn mb-1">Danger zone</p>
        <p className="text-xs text-ink-muted">Account deletion isn't available yet — contact your administrator.</p>
      </div>
    </main>
  );
}
