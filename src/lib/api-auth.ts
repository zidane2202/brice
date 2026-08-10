import { requireActiveSeller } from "@/lib/authz";
import { NextResponse } from "next/server";

export async function activeSellerOrResponse() {
  try {
    const result = await requireActiveSeller();
    return { ok: true as const, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accès refusé";
    const status = message === "Non authentifié" ? 401 : 403;
    return { ok: false as const, response: NextResponse.json({ error: message }, { status }) };
  }
}
