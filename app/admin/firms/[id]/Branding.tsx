"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Palette, Upload, Loader2, Check } from "lucide-react";

const PRESETS = [
  { name: "Default", color: "#0B5C52", accent: "#C9971E" },
  { name: "Navy", color: "#1B3A5C", accent: "#D4A24C" },
  { name: "Charcoal", color: "#2B2B2B", accent: "#8B7355" },
  { name: "Forest", color: "#2D4A32", accent: "#B8935A" },
  { name: "Burgundy", color: "#5C1B2B", accent: "#C9A227" },
];

export function Branding({ firmId, firmName }: { firmId: string; firmName: string }) {
  const supabase = createClient();
  const [color, setColor] = useState("#0B5C52");
  const [accent, setAccent] = useState("#C9971E");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("firms").select("brand_color, brand_accent, brand_logo_url").eq("id", firmId).single()
      .then(({ data }) => {
        if (data?.brand_color) setColor(data.brand_color);
        if (data?.brand_accent) setAccent(data.brand_accent);
        if (data?.brand_logo_url) setLogoUrl(data.brand_logo_url);
      });
  }, [firmId]);

  async function handleLogo(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    const path = `${firmId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
    if (upErr) { setError(upErr.message); setUploading(false); return; }
    const { data } = supabase.storage.from("branding").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setUploading(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/update-branding", {
      method: "POST",
      body: JSON.stringify({ firmId, brandColor: color, brandAccent: accent, brandLogoUrl: logoUrl }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    else setError(data.error ?? "Save failed");
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6 card-shadow">
      <div className="flex items-center gap-2 mb-4">
        <Palette size={15} className="text-teal" />
        <p className="font-mono text-xs text-teal uppercase tracking-widest">Branding</p>
      </div>

      <p className="text-xs text-ink-muted mb-2">Preset themes</p>
      <div className="flex gap-2 mb-4 flex-wrap">
        {PRESETS.map((p) => (
          <button key={p.name} onClick={() => { setColor(p.color); setAccent(p.accent); }}
            className={`flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 text-xs transition
              ${color === p.color ? "border-teal bg-teal-soft" : "border-border hover:border-teal/40"}`}>
            <span className="w-3 h-3 rounded-full" style={{ background: p.color }} />
            <span className="w-2 h-2 rounded-full" style={{ background: p.accent }} />
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs text-ink-muted mb-1.5">Primary</p>
          <div className="flex gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
              className="w-10 h-9 rounded border border-border cursor-pointer" />
            <input value={color} onChange={(e) => setColor(e.target.value)}
              className="border border-border rounded-md px-2 py-1.5 text-xs font-mono flex-1 bg-paper text-ink" />
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-muted mb-1.5">Accent</p>
          <div className="flex gap-2">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
              className="w-10 h-9 rounded border border-border cursor-pointer" />
            <input value={accent} onChange={(e) => setAccent(e.target.value)}
              className="border border-border rounded-md px-2 py-1.5 text-xs font-mono flex-1 bg-paper text-ink" />
          </div>
        </div>
      </div>

      <label className="flex items-center gap-3 border border-dashed border-border rounded-md px-3.5 py-3 cursor-pointer hover:border-teal transition mb-4">
        {uploading ? <Loader2 size={16} className="animate-spin text-ink-muted" /> : <Upload size={16} className="text-ink-muted" />}
        <span className="text-sm text-ink-muted truncate">{logoUrl ? "Replace logo" : "Upload logo"}</span>
        <input type="file" accept="image/*" onChange={(e) => handleLogo(e.target.files?.[0] ?? null)} className="hidden" />
      </label>

      <p className="text-xs text-ink-muted mb-2">Preview</p>
      <div className="border border-border rounded-lg overflow-hidden mb-4" style={{ background: "#F7F6F1" }}>
        <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: color }}>
          {logoUrl
            ? <img src={logoUrl} alt="" className="h-6 w-auto object-contain" />
            : <div className="w-6 h-6 rounded" style={{ background: accent }} />}
          <span className="text-sm font-medium" style={{ color: "#FFFFFF" }}>{firmName}</span>
        </div>
        <div className="p-4 space-y-2">
          <div className="h-2 rounded-full w-3/4" style={{ background: "#E3E0D2" }} />
          <div className="h-2 rounded-full w-1/2" style={{ background: "#E3E0D2" }} />
          <div className="flex gap-2 pt-1">
            <div className="px-3 py-1.5 rounded-md text-xs" style={{ background: color, color: "#FFF" }}>Primary</div>
            <div className="px-3 py-1.5 rounded-md text-xs" style={{ background: accent, color: "#FFF" }}>Accent</div>
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center justify-center gap-2 bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 w-full hover:opacity-90 transition disabled:opacity-50">
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
        {saving ? "Saving…" : saved ? "Saved" : "Save branding"}
      </button>
      {error && <p className="text-xs text-warn mt-2">{error}</p>}
    </div>
  );
}
