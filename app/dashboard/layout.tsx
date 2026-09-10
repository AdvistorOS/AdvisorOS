import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Sidebar } from "./Sidebar";
import { ToastProvider } from "./ToastProvider";
import { OfflineBanner } from "./OfflineBanner";
import { missingRecordingSettings } from "@/lib/processing/config";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let brandColor = "#0B5C52";
  let brandAccent = "#C9971E";
  let logoUrl: string | null = null;

  if (user) {
    const { data: adviser } = await supabaseAdmin
      .from("advisers").select("firm_id").eq("id", user.id).single();
    if (adviser?.firm_id) {
      const { data: firm } = await supabaseAdmin
        .from("firms").select("brand_color, brand_accent, brand_logo_url").eq("id", adviser.firm_id).single();
      if (firm?.brand_color) brandColor = firm.brand_color;
      if (firm?.brand_accent) brandAccent = firm.brand_accent;
      if (firm?.brand_logo_url) logoUrl = firm.brand_logo_url;
    }
  }

  return (
    <div style={{ "--brand-color": brandColor, "--brand-accent": brandAccent } as React.CSSProperties}>
      <ToastProvider>
        <OfflineBanner />
        <div className="flex min-h-screen bg-paper">
          <Sidebar email={user?.email ?? ""} brandColor={brandColor} brandAccent={brandAccent} logoUrl={logoUrl} />
          <div id="main-content" className="flex-1 min-w-0 pt-16 md:pt-0">
            {missingRecordingSettings().length > 0 && (
              <div role="status" className="mx-4 mt-4 md:mx-8 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-ink">
                <p className="font-semibold">Recording analysis setup is incomplete</p>
                <p className="mt-1 text-ink-muted">Ask your workspace administrator to finish the processing settings before uploading a new recording. Your saved client records remain available.</p>
              </div>
            )}
            {children}
          </div>
        </div>
      </ToastProvider>
    </div>
  );
}
