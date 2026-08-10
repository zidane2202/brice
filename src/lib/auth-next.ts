const ALLOWED = new Set(["/reset-password", "/dashboard", "/login"]);

export function safeAuthNextPath(raw: string | null | undefined, fallback = "/dashboard") {
  const next = String(raw ?? "").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.includes("://")) {
    return fallback;
  }
  const path = next.split("?")[0].split("#")[0];
  if (ALLOWED.has(path) || path.startsWith("/reset-password")) return path;
  return fallback;
}
