import { createHmac, timingSafeEqual } from "node:crypto";

function signature(meetingId: string, token: string) {
  const key = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
  if (!key || key.length < 32) throw new Error("Set ASSEMBLYAI_WEBHOOK_SECRET to at least 32 random characters.");
  return createHmac("sha256", key).update(`${meetingId}:${token}`).digest("hex");
}
export function webhookUrl(meetingId: string, token: string) {
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || new URL(origin).protocol !== "https:") throw new Error("NEXT_PUBLIC_APP_URL must be your HTTPS application URL.");
  const url = new URL("/api/transcript-webhook", origin);
  url.searchParams.set("meetingId", meetingId);
  url.searchParams.set("token", token);
  url.searchParams.set("signature", signature(meetingId, token));
  return url.toString();
}
export function validSignature(meetingId: string, token: string, supplied: string) {
  if (!/^[a-f0-9]{64}$/.test(supplied)) return false;
  try { return timingSafeEqual(Buffer.from(signature(meetingId, token), "hex"), Buffer.from(supplied, "hex")); }
  catch { return false; }
}
