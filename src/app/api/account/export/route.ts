import { NextResponse } from "next/server";
import { activeSellerOrResponse } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { todayDateOnly } from "@/lib/dates";

const PAGE = 1000;

async function selectAll(
  db: ReturnType<typeof createSupabaseAdmin>,
  table: string,
  filter: { column: string; value: string | string[] }
) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db.from(table).select("*").range(from, from + PAGE - 1);
    query = Array.isArray(filter.value)
      ? query.in(filter.column, filter.value)
      : query.eq(filter.column, filter.value);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}

export async function GET() {
  const authz = await activeSellerOrResponse();
  if (!authz.ok) return authz.response;
  const user = authz.user;
  const db = createSupabaseAdmin();
  const tables = ["user_profiles", "provider_accounts", "clients", "client_subscriptions", "transactions", "invoices"] as const;
  const entries = await Promise.all(
    tables.map(async (table) => {
      const data = await selectAll(db, table, { column: "user_id", value: user.id });
      if (table === "provider_accounts") {
        return [table, data.map(({ account_password: _password, ...row }) => row)] as const;
      }
      return [table, data] as const;
    })
  );
  const accountIds = (
    (entries.find(([table]) => table === "provider_accounts")?.[1] ?? []) as Array<{ id: string }>
  ).map((account) => account.id);
  const slots = accountIds.length
    ? await selectAll(db, "account_slots", { column: "account_id", value: accountIds })
    : [];
  const events = await selectAll(db, "client_events", { column: "user_id", value: user.id });
  entries.push(["account_slots" as never, slots] as never, ["client_events" as never, events] as never);
  return new NextResponse(
    JSON.stringify(
      { exported_at: new Date().toISOString(), user_email: user.email, data: Object.fromEntries(entries) },
      null,
      2
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="subresell-export-${todayDateOnly()}.json"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
