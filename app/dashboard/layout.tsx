import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar email={user?.email ?? ""} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
