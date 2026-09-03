import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { AdviserRow } from "./AdviserRow";

export default async function AllAdvisersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: isAdmin } = await supabaseAdmin
    .from("super_admins").select("email").eq("email", user.email).maybeSingle();
  if (!isAdmin) redirect("/dashboard");

  const { data: advisers } = await supabaseAdmin
    .from("advisers").select("id, full_name, email, firm_id, role").order("full_name");
  const { data: firms } = await supabaseAdmin.from("firms").select("id, name").order("name");

  return (
    <div className="min-h-screen bg-paper px-6 py-16">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/admin" className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-teal transition">
          <ArrowLeft size={13} /> Admin
        </Link>
        <div className="flex items-center gap-2 justify-center">
          <Users size={18} className="text-teal" />
          <p className="font-display text-xl text-ink">All advisers ({advisers?.length ?? 0})</p>
        </div>
        <div className="space-y-2">
          {advisers?.map((a) => (
            <AdviserRow key={a.id} adviser={a} firms={firms ?? []} />
          ))}
          {!advisers?.length && (
            <p className="text-sm text-ink-muted text-center">No advisers created yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
