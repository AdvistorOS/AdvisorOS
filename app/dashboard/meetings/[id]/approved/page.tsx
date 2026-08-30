"use client";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, FileText, Mail, Users } from "lucide-react";

export default function ApprovedPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const facts = params.get("facts") ?? "0";
  const objectives = params.get("objectives") ?? "0";
  const risk = params.get("risk") === "1";
  const actions = params.get("actions") ?? "0";
  const missing = params.get("missing") ?? "0";
  const clientId = params.get("clientId") ?? "";

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-surface border border-border rounded-xl p-8 card-shadow text-center">
        <div className="w-14 h-14 rounded-full bg-good-soft flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={26} className="text-good" />
        </div>
        <h1 className="font-display text-2xl text-ink mb-1">Meeting approved</h1>
        <p className="text-ink-muted text-sm mb-6">Client record updated</p>

        <div className="text-left bg-paper border border-border rounded-md p-5 mb-6 space-y-1.5 text-sm text-ink">
          <p>• {facts} fact{facts !== "1" ? "s" : ""} added</p>
          {Number(objectives) > 0 && <p>• {objectives} objective{objectives !== "1" ? "s" : ""} added</p>}
          {risk && <p>• Risk information updated</p>}
          <p>• {actions} action{actions !== "1" ? "s" : ""} created</p>
          <p>• {missing} missing-information item{missing !== "1" ? "s" : ""} identified</p>
        </div>

        <div className="space-y-2">
          <Link href={`/dashboard/clients/${clientId}`}
            className="flex items-center justify-center gap-2 bg-teal text-paper text-sm font-medium rounded-md px-4 py-2.5 hover:opacity-90 transition w-full">
            <Users size={15} /> View Client Record
          </Link>
          <Link href={`/dashboard/meetings/${id}/file-note`}
            className="flex items-center justify-center gap-2 bg-surface border border-border text-ink text-sm font-medium rounded-md px-4 py-2.5 hover:bg-paper transition w-full">
            <FileText size={15} /> Generate File Note
          </Link>
          <Link href={`/dashboard/meetings/${id}/followup-email`}
            className="flex items-center justify-center gap-2 bg-surface border border-border text-ink text-sm font-medium rounded-md px-4 py-2.5 hover:bg-paper transition w-full">
            <Mail size={15} /> Draft Follow-up Email
          </Link>
        </div>
      </div>
    </div>
  );
}
