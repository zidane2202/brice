export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_BUCKET = "logos";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isAllowedLogoMime(mime: string): boolean {
  return ALLOWED.has(mime);
}

export function resolveBrandName(
  profile: { company_name?: string | null } | null | undefined,
  fallback?: string | null
): string {
  const name = profile?.company_name?.trim();
  if (name) return name;
  const fb = fallback?.trim();
  if (fb) return fb;
  return "subresell";
}

export function resolveBrandLogoUrl(
  profile: { logo_url?: string | null } | null | undefined
): string | null {
  const url = profile?.logo_url?.trim();
  return url || null;
}

export function logoObjectPath(userId: string, mime: string): string {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return `${userId}/logo.${ext}`;
}
