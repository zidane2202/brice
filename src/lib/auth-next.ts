const ALLOWED = new Set(["/reset-password", "/dashboard", "/login"]);

export function safeAuthNextPath(raw: string | null | undefined, fallback = "/dashboard") {
  const next = String(raw ?? "").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.includes("://")) {
    return fallback;
  }
  if (next.includes("..") || /%2e/i.test(next)) return fallback;
  let path: string;
  try {
    path = new URL(next, "http://local.invalid").pathname;
  } catch {
    return fallback;
  }
  if (!ALLOWED.has(path)) return fallback;
  return path;
}
