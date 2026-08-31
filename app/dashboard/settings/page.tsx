"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "../ToastProvider";
import { User, Sparkles, Save } from "lucide-react";

export default function SettingsPage() {
  const supabase = createClient();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [summaryStyle, setSummaryStyle] = useState("short");
  const [autoExtract, setAutoExtract] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data: adviser } = await supabase.from("advisers").select("*").eq("id", user.id).single();
      setFullName(adviser?.full_name ?? "");
      setSummaryStyle(adviser?.preferences?.summary_style ?? "short");
      setAutoExtract(adviser?.preferences?.auto_extract ?? true);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await supabase.from("advisers").update({
      full_name: fullName,
      preferences: { summary_style: summaryStyle, auto_extract: autoExtract },
    }).eq("id", user.id);

    setSaving(false);
    if (error) toast(error.message, "error");
    else toast("Settings saved");
  }

  return (
    <main className="max-w-xl mx-auto px-8 py-10 space-y-6">
      <h1 className="font-display text-3xl text-ink mb-1">Settings</h1>
      <p className="text-ink-muted text-sm mb-6">Your preferences for how AdvisorOS works.</p>

      <section className="bg-surface border border-border rounded-xl p-6 card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <User size={15} className="text-teal" />
          <p className="font-mono text-xs text-teal uppercase tracking-widest">General</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-ink-muted block mb-1.5">Your name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-paper text-ink text-sm focus:outline-none focus:border-teal" />
          </div>
          <div>
            <label className="text-xs text-ink-muted block mb-1.5">Email</label>
            <input value={email} disabled
              className="border border-border rounded-md px-3.5 py-2.5 w-full bg-border/30 text-ink-muted text-sm" />
          </div>
        </div>
      </section>

      <section className="bg-surface border border-border rounded-xl p-6 card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={15} className="text-teal" />
          <p className="font-mono text-xs text-teal uppercase tracking-widest">AI preferences</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-ink-muted block mb-1.5">Meeting summary style</label>
            <div className="flex gap-2">
              <button onClick={() => setSummaryStyle("short")}
                className={`text-sm px-3 py-2 rounded-md border transition ${summaryStyle === "short" ? "bg-teal text-paper border-teal" : "border-border text-ink-muted"}`}>
                Short
              </button>
              <button onClick={() => setSummaryStyle("detailed")}
                className={`text-sm px-3 py-2 rounded-md border transition ${summaryStyle === "detailed" ? "bg-teal text-paper border-teal" : "border-border text-ink-muted"}`}>
                Detailed
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={autoExtract} onChange={(e) => setAutoExtract(e.target.checked)}
              className="w-4 h-4 accent-teal" />
            <span className="text-sm text-ink">Automatically extract facts after every meeting</span>
          </label>
        </div>
      </section>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center justify-center gap-2 bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
        <Save size={15} />
        {saving ? "Saving…" : "Save settings"}
      </button>
    </main>
  );
}
