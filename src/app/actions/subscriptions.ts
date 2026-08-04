"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import { addMonths, toDateInputValue } from "@/lib/dates";
import { createInvoice } from "@/lib/invoices";
import { recordClientEvent } from "@/lib/client-events";

function req(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

export async function renewClientSubscription(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const durationMonths = parseInt(req(formData, "duration_months") || "1");
  if (!id || !Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 24) {
    throw new Error("Renouvellement invalide (1 à 24 mois).");
  }

  const supabase = createSupabaseAdmin();
  const { data: existing } = await supabase
    .from("client_subscriptions")
    .select("end_date, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!existing) throw new Error("Abonnement introuvable.");
  const baseDate = existing.status === "grace" || new Date(`${existing.end_date}T23:59:59`) > new Date()
    ? existing.end_date
    : toDateInputValue();
  const newEndDate = addMonths(baseDate, durationMonths);
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
      label: `Renouvellement ${service} · ${who}`,
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
  if (sub) await recordClientEvent(supabase, { userId: user.id, clientId: sub.client_id, subscriptionId: id, type: "subscription_renewed", title: "Abonnement renouvelé", details: { periodStart: baseDate, periodEnd: newEndDate, amount: sub.price } });

  revalidatePath("/clients");
  revalidatePath("/dashboard");
}

export async function cancelClientSubscription(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const supabase = createSupabaseAdmin();

  const { data: cancelled, error } = await supabase
    .from("client_subscriptions")
    .update({ status: "cancelled", grace_until: null })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("client_id")
    .single();

  if (error) throw new Error(error.message);
  await recordClientEvent(supabase, { userId: user.id, clientId: cancelled.client_id, subscriptionId: id, type: "subscription_cancelled", title: "Abonnement annulé" });
  revalidatePath("/clients");
}

export async function setGraceStatus(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const graceUntil = req(formData, "grace_until");
  const supabase = createSupabaseAdmin();

  const { data: graceSub, error } = await supabase
    .from("client_subscriptions")
    .update({ status: "grace", grace_until: graceUntil })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("client_id")
    .single();

  if (error) throw new Error(error.message);
  await recordClientEvent(supabase, { userId: user.id, clientId: graceSub.client_id, subscriptionId: id, type: "grace_started", title: "Période de grâce activée", details: { graceUntil } });
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

export async function updateInvoiceStatus(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");
  const id = req(formData, "invoice_id");
  const status = req(formData, "status");
  if (!new Set(["paid", "cancelled", "refunded"]).has(status)) throw new Error("Statut de facture invalide");
  const { error } = await createSupabaseAdmin().from("invoices").update({ status }).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/clients"); revalidatePath("/facture", "layout");
}
