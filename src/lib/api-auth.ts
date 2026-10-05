import { requireSeller } from "@/lib/authz";
import { PLAN_EXPIRED } from "@/lib/plans";
import { NextResponse } from "next/server";

export async function activeSellerOrResponse({ write = false }: { write?: boolean } = {}) {
  try {
    const { planExpired, ...result } = await requireSeller();
    if (write && planExpired) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { error: "Votre pack a expiré : renouvelez-le pour modifier vos données.", code: PLAN_EXPIRED },
          { status: 403 }
        ),
      };
    }
    return { ok: true as const, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accès refusé";
    const status = message === "Non authentifié" ? 401 : 403;
    return { ok: false as const, response: NextResponse.json({ error: message }, { status }) };
  }
}
