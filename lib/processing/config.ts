// Returns setting names only. Never return credentials to UI or logs.
export function missingRecordingSettings(env: NodeJS.ProcessEnv = process.env): string[] {
  const missing: string[] = [];
  if (!env.ASSEMBLYAI_API_KEY?.trim()) missing.push("ASSEMBLYAI_API_KEY");
  if (!env.ANTHROPIC_API_KEY?.trim()) missing.push("ANTHROPIC_API_KEY");
  if ((env.ASSEMBLYAI_WEBHOOK_SECRET?.trim().length ?? 0) < 32) missing.push("ASSEMBLYAI_WEBHOOK_SECRET (at least 32 characters)");
  let validOrigin = false;
  try {
    const url = new URL(env.NEXT_PUBLIC_APP_URL ?? "");
    validOrigin = url.protocol === "https:" && !url.username && !url.password;
  } catch {}
  if (!validOrigin) missing.push("NEXT_PUBLIC_APP_URL (HTTPS website address)");
  return missing;
}
