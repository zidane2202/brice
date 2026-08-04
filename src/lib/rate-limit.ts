import { createHash } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function consumeRateLimit(identity: string, action: string, limit: number, windowSeconds: number) {
  const digest = createHash("sha256").update(identity || "unknown").digest("hex");
  const { data, error } = await createSupabaseAdmin().rpc("consume_rate_limit", {
    p_key: `${action}:${digest}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit]", error.message);
    return true;
  }
  return data === true;
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}
