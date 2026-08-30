import { createClient } from "@/lib/supabase/server";
import { FileAudio, FileText } from "lucide-react";

export default async function FilesPage() {
  const supabase = await createClient();
  const { data: meetings } = await supabase.from("meetings").select("id, media_url, created_at, clients(full_name)").order("created_at", { ascending: false });

  return (
    <main className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="font-display text-3xl text-ink mb-1">Files</h1>
      <p className="text-ink-muted text-sm mb-8">Meeting recordings, grouped by client.</p>

      <div className="space-y-2.5">
        {meetings?.map((m: any) => (
          <div key={m.id} className="flex items-center gap-3 bg-surface border border-border rounded-lg px-5 py-3.5 card-shadow">
            <FileAudio size={16} className="text-teal flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink truncate">{m.clients?.full_name} — recording</p>
              <p className="text-xs text-ink-muted">{new Date(m.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border border-dashed border-border rounded-xl p-6 text-center">
        <p className="text-xs text-ink-muted">Folders, drag-and-drop upload, and generated document storage are coming next.</p>
      </div>
    </main>
  );
}
