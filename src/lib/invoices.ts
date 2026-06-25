import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function generateInvoiceCode(): string {
  return randomBytes(6).toString("hex");
}

async function nextInvoiceNumber(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase
    .from("invoices")
    .select("number")
    .eq("user_id", userId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data?.number as number | undefined) ?? 0) + 1;
}

export type CreateInvoiceInput = {
  userId: string;
  clientId: string | null;
  subscriptionId: string | null;
  amount: number;
  serviceName: string;
  slotLabel: string | null;
  periodStart: string;
  periodEnd: string;
  kind: "new" | "renewal";
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  paymentRail: string | null;
};

export async function createInvoice(
  supabase: SupabaseClient,
  input: CreateInvoiceInput
): Promise<{ number: number; code: string } | null> {
  if (!input.amount || input.amount <= 0) return null;

  const number = await nextInvoiceNumber(supabase, input.userId);
  const code = generateInvoiceCode();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name, last_name, company_name")
    .eq("user_id", input.userId)
    .maybeSingle();
  const resellerName =
    profile?.company_name?.trim() ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    null;

  const { error } = await supabase.from("invoices").insert({
    user_id: input.userId,
    number,
    code,
    client_id: input.clientId,
    subscription_id: input.subscriptionId,
    amount: input.amount,
    service_name: input.serviceName,
    service_slot: input.slotLabel,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    kind: input.kind,
    client_name: input.clientName,
    client_phone: input.clientPhone,
    client_email: input.clientEmail,
    payment_rail: input.paymentRail,
    reseller_name: resellerName,
  });
  if (error) {
    console.error("createInvoice error", error);
    throw new Error(`Facture non générée : ${error.message}`);
  }
  return { number, code };
}
