export function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|llp|inc|corp|company|co|group|holdings|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function domainFromEmail(email?: string | null): string | null {
  if (!email || !email.includes("@")) return null;
  const d = email.split("@")[1]?.toLowerCase().trim();
  if (!d) return null;
  const generic = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com", "aol.com"];
  return generic.includes(d) ? null : d;
}

export type MatchCandidate = {
  id: string;
  full_name: string;
  normalised_name?: string | null;
  domain?: string | null;
  aliases?: string[] | null;
};

export function findBestMatch(input: string, email: string | null, candidates: MatchCandidate[]) {
  const normInput = normalise(input);
  const inputDomain = domainFromEmail(email);

  for (const c of candidates) {
    if (inputDomain && c.domain && c.domain === inputDomain) {
      return { match: c, reason: "email domain", strength: "strong" as const };
    }
  }
  for (const c of candidates) {
    if (c.normalised_name && c.normalised_name === normInput) {
      return { match: c, reason: "name", strength: "strong" as const };
    }
  }
  for (const c of candidates) {
    if (c.aliases?.some((a) => normalise(a) === normInput)) {
      return { match: c, reason: "known alias", strength: "strong" as const };
    }
  }
  for (const c of candidates) {
    const cn = c.normalised_name ?? normalise(c.full_name);
    if (normInput.length >= 4 && (cn.includes(normInput) || normInput.includes(cn))) {
      return { match: c, reason: "similar name", strength: "likely" as const };
    }
  }
  return null;
}
