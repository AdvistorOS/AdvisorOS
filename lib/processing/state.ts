import { supabaseAdmin } from "@/lib/supabase/admin";

export function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export async function begin(meetingId: string, phase: "transcribing" | "extracting", retry = false): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("begin_meeting_processing", { p_id: meetingId, p_phase: phase, p_retry: retry });
  check(error);
  return data;
}
export async function fail(meetingId: string, token: string, message = "Analysis could not finish. Your recording and transcript are retained. Please retry.") {
  const { error } = await supabaseAdmin.from("meetings").update({ status: "failed", processing_error: message })
    .eq("id", meetingId).eq("processing_token", token).neq("status", "done");
  check(error);
}
export async function saveTranscript(meetingId: string, token: string, text: string, utterances: unknown[] = []) {
  const { data, error } = await supabaseAdmin.rpc("save_meeting_transcript", {
    p_id: meetingId, p_token: token, p_text: text, p_utterances: utterances,
  });
  check(error);
  return data === true;
}
