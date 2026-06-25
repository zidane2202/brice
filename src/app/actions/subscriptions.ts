"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import { addMonths, toDateInputValue } from "@/lib/dates";
import { createInvoice } from "@/lib/invoices";

function req(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

export async function renewClientSubscription(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const currentEndDate = req(formData, "end_date");
  const durationMonths = parseInt(req(formData, "duration_months") || "1");
  const isGrace = String(formData.get("status") ?? "") === "grace";
  // En grâce : on repart toujours de la date de fin d'origine, pas d'aujourd'hui
  const baseDate = isGrace || new Date(`${currentEndDate}T00:00:00`) > new Date()
    ? currentEndDate
    : toDateInputValue();
  const newEndDate = addMonths(baseDate, durationMonths);

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("client_subscriptions")
    .update({
      end_date: newEndDate,
      start_date: baseDate,
      status: "active",
      grace_until: null,
      last_notified_on: null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  const { data: sub } = await supabase
    .from("client_subscriptions")
    .select(`
      price, client_id,
      client:clients(first_name, last_name, phone, email, payment_rail),
      slot:account_slots(label, slot_number, account:provider_accounts(service_name))
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (sub?.price && sub.price > 0) {
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
    await supabase.from("transactions").insert({
      user_id: user.id,
      kind: "income",
      source: "profile_renewal",
      affects_balance: true,
      amount: sub.price,
      client_id: sub.client_id,
      subscription_id: id,
      label: `Renouvellement ${service} — ${who}`,
    });
    await createInvoice(supabase, {
      userId: user.id,
      clientId: sub.client_id,
      subscriptionId: id,
      amount: sub.price,
      serviceName: service,
      slotLabel,
      periodStart: baseDate,
      periodEnd: newEndDate,
      kind: "renewal",
      clientName: who,
      clientPhone: client?.phone ?? null,
      clientEmail: client?.email ?? null,
      paymentRail: client?.payment_rail ?? null,
    });
  }

  revalidatePath("/clients");
  revalidatePath("/dashboard");
}

export async function cancelClientSubscription(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("client_subscriptions")
    .update({ status: "cancelled", grace_until: null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/clients");
}

export async function setGraceStatus(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const graceUntil = req(formData, "grace_until");
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("client_subscriptions")
    .update({ status: "grace", grace_until: graceUntil })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/abonnements");
  revalidatePath("/clients");
  revalidatePath("/dashboard");
}

export async function generateInvoiceForSubscription(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const supabase = createSupabaseAdmin();

  const { data: sub, error } = await supabase
    .from("client_subscriptions")
    .select(`
      id, start_date, end_date, price, client_id,
      client:clients(first_name, last_name, phone, email, payment_rail),
      slot:account_slots(label, slot_number, account:provider_accounts(service_name))
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !sub) throw new Error("Abonnement introuvable");
  if (!sub.price || sub.price <= 0) throw new Error("Aucun prix sur cet abonnement");

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

  await createInvoice(supabase, {
    userId: user.id,
    clientId: sub.client_id,
    subscriptionId: sub.id,
    amount: sub.price,
    serviceName: service,
    slotLabel,
    periodStart: sub.start_date,
    periodEnd: sub.end_date,
    kind: "new",
    clientName: who,
    clientPhone: client?.phone ?? null,
    clientEmail: client?.email ?? null,
    paymentRail: client?.payment_rail ?? null,
  });

  revalidatePath("/clients");
}

export async function removeGraceStatus(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("client_subscriptions")
    .update({ status: "active", grace_until: null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/abonnements");
  revalidatePath("/clients");
  revalidatePath("/dashboard");
}
