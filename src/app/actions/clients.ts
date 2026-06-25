"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import { addMonths, toDateInputValue } from "@/lib/dates";
import { createInvoice } from "@/lib/invoices";

function req(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  if (!v) throw new Error(`${key} requis`);
  return v;
}

function opt(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

export async function addClientWithSubscription(
  formData: FormData
): Promise<{ invoiceCode: string | null; clientName: string; clientPhone: string | null }> {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const firstName = req(formData, "first_name");
  const lastName = opt(formData, "last_name");
  const slotId = req(formData, "slot_id");
  const startDate = req(formData, "start_date");
  const durationMonths = parseInt(req(formData, "duration_months"));
  const price = formData.get("price") ? parseFloat(String(formData.get("price"))) : null;
  const endDate = addMonths(startDate, durationMonths);

  const supabase = createSupabaseAdmin();

  // Verify the slot belongs to an account owned by this user
  const { data: slot } = await supabase
    .from("account_slots")
    .select("id, account_id, provider_accounts(user_id)")
    .eq("id", slotId)
    .single();

  const accountOwner = (slot?.provider_accounts as unknown as { user_id: string } | null)?.user_id;
  if (!slot || accountOwner !== user.id) throw new Error("Slot invalide");

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      email: opt(formData, "email"),
      phone: opt(formData, "phone"),
      payment_rail: opt(formData, "payment_rail"),
      pin_code: opt(formData, "pin_code"),
    })
    .select("id")
    .single();

  if (clientError) throw new Error(clientError.message);

  const { data: sub, error: subError } = await supabase
    .from("client_subscriptions")
    .insert({
      user_id: user.id,
      slot_id: slotId,
      client_id: client.id,
      start_date: startDate,
      end_date: endDate,
      duration_months: durationMonths,
      price,
      status: "active",
    })
    .select("id")
    .single();

  if (subError) throw new Error(subError.message);

  const clientName = [firstName, lastName].filter(Boolean).join(" ");
  const clientPhone = opt(formData, "phone");
  let invoiceCode: string | null = null;

  if (price && price > 0 && sub) {
    const { data: serviceRow } = await supabase
      .from("account_slots")
      .select("label, slot_number, provider_accounts(service_name)")
      .eq("id", slotId)
      .single();
    const serviceName =
      (serviceRow?.provider_accounts as unknown as { service_name: string } | null)?.service_name ?? "Profil";
    const slotLabel =
      (serviceRow?.label as string | undefined) ||
      `Profil ${(serviceRow?.slot_number as number | undefined) ?? ""}`.trim();
    await supabase.from("transactions").insert({
      user_id: user.id,
      kind: "income",
      source: "new_profile",
      affects_balance: true,
      amount: price,
      client_id: client.id,
      subscription_id: sub.id,
      label: `Vente ${serviceName} — ${clientName}`,
    });
    const result = await createInvoice(supabase, {
      userId: user.id,
      clientId: client.id,
      subscriptionId: sub.id,
      amount: price,
      serviceName,
      slotLabel,
      periodStart: startDate,
      periodEnd: endDate,
      kind: "new",
      clientName,
      clientPhone,
      clientEmail: opt(formData, "email"),
      paymentRail: opt(formData, "payment_rail"),
    });
    invoiceCode = result?.code ?? null;
  }

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { invoiceCode, clientName, clientPhone };
}

export async function updateClientMeta(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const notes = opt(formData, "notes");
  const paymentRail = opt(formData, "payment_rail");

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("clients")
    .update({ notes, payment_rail: paymentRail })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/clients");
}

export async function updateClientPin(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const pinCode = opt(formData, "pin_code");

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("clients")
    .update({ pin_code: pinCode })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/clients");
  revalidatePath("/abonnements");
}

export async function bulkRenewSubscriptions(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const idsRaw = String(formData.get("ids") ?? "");
  const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return;

  const supabase = createSupabaseAdmin();

  const { data: subs } = await supabase
    .from("client_subscriptions")
    .select(`
      id, end_date, status, price, client_id,
      client:clients(first_name, last_name, phone, email, payment_rail),
      slot:account_slots(label, slot_number, account:provider_accounts(service_name))
    `)
    .in("id", ids)
    .eq("user_id", user.id);

  if (!subs || subs.length === 0) return;

  const today = toDateInputValue();
  const txInserts: Array<Record<string, unknown>> = [];
  for (const sub of subs) {
    const isGrace = sub.status === "grace";
    const baseDate = isGrace || sub.end_date > today ? sub.end_date : today;
    const newEnd = addMonths(baseDate, 1);
    await supabase
      .from("client_subscriptions")
      .update({
        start_date: baseDate,
        end_date: newEnd,
        status: "active",
        grace_until: null,
        last_notified_on: null,
      })
      .eq("id", sub.id)
      .eq("user_id", user.id);

    if (sub.price && sub.price > 0) {
      const client = sub.client as unknown as {
        first_name: string;
        last_name: string | null;
        phone: string | null;
        email: string | null;
        payment_rail: string | null;
      } | null;
      const slot = sub.slot as unknown as {
        label: string | null;
        slot_number: number;
        account: { service_name: string } | null;
      } | null;
      const service = slot?.account?.service_name ?? "profil";
      const slotLabel = slot?.label || `Profil ${slot?.slot_number ?? ""}`.trim();
      const who = client ? [client.first_name, client.last_name].filter(Boolean).join(" ") : "Client";
      txInserts.push({
        user_id: user.id,
        kind: "income",
        source: "profile_renewal",
        affects_balance: true,
        amount: sub.price,
        client_id: sub.client_id,
        subscription_id: sub.id,
        label: `Renouvellement ${service} — ${who}`,
      });
      await createInvoice(supabase, {
        userId: user.id,
        clientId: sub.client_id,
        subscriptionId: sub.id,
        amount: sub.price,
        serviceName: service,
        slotLabel,
        periodStart: baseDate,
        periodEnd: newEnd,
        kind: "renewal",
        clientName: who,
        clientPhone: client?.phone ?? null,
        clientEmail: client?.email ?? null,
        paymentRail: client?.payment_rail ?? null,
      });
    }
  }

  if (txInserts.length > 0) {
    await supabase.from("transactions").insert(txInserts);
  }

  revalidatePath("/clients");
  revalidatePath("/dashboard");
}

export async function bulkCancelSubscriptions(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const idsRaw = String(formData.get("ids") ?? "");
  const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("client_subscriptions")
    .update({ status: "cancelled", grace_until: null })
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/clients");
}
