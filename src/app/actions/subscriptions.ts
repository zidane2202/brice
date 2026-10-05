"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveSeller } from "@/lib/authz";
import { addMonths, todayDateOnly } from "@/lib/dates";
import { createInvoice } from "@/lib/invoices";
import { recordClientEvent } from "@/lib/client-events";
import { canUseFullCompta, normalizePlan } from "@/lib/plans";
import { currentSlotSubscription, occupiesSlot } from "@/lib/slots";

function req(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

async function assertSlotNotResold(supabase: ReturnType<typeof createSupabaseAdmin>, userId: string, subscriptionId: string) {
  const { data: sub } = await supabase
    .from("client_subscriptions")
    .select("slot_id")
    .eq("id", subscriptionId)
    .eq("user_id", userId)
    .single();
  if (!sub?.slot_id) return;
  const { data: others } = await supabase
    .from("client_subscriptions")
    .select("id, status, end_date, grace_until, client:clients(first_name, last_name)")
    .eq("slot_id", sub.slot_id)
    .eq("user_id", userId)
    .neq("id", subscriptionId)
    .in("status", ["active", "grace"]);
  const occupant = currentSlotSubscription(others, todayDateOnly());
  if (!occupant) return;
  const client = occupant.client as unknown as { first_name?: string; last_name?: string | null } | null;
  const name = [client?.first_name, client?.last_name].filter(Boolean).join(" ") || "un autre client";
  throw new Error(`Ce profil a été revendu à ${name}. Créez une nouvelle vente sur un profil libre.`);
}

export async function renewClientSubscription(formData: FormData) {
  const { user } = await requireActiveSeller();

  const id = req(formData, "id");
  const durationMonths = parseInt(req(formData, "duration_months") || "1");
  if (!id || !Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 24) {
    throw new Error("Renouvellement invalide (1 à 24 mois).");
  }

  const supabase = createSupabaseAdmin();
  const { data: existing } = await supabase
    .from("client_subscriptions")
    .select("end_date, start_date, status, grace_until")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!existing) throw new Error("Abonnement introuvable.");
  const today = todayDateOnly();
  if (!occupiesSlot(existing, today)) await assertSlotNotResold(supabase, user.id, id);
  const baseDate =
    existing.status === "grace" || existing.end_date >= today ? existing.end_date : today;
  const newEndDate = addMonths(baseDate, durationMonths);
  const previous = {
    end_date: existing.end_date,
    start_date: existing.start_date as string | undefined,
    status: existing.status,
    grace_until: (existing as { grace_until?: string | null }).grace_until ?? null,
  };

  const { error } = await supabase
    .from("client_subscriptions")
    .update({
      end_date: newEndDate,
      start_date: baseDate,
      status: "active",
      grace_until: null,
      last_notified_on: null,
      duration_months: durationMonths,
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

  async function rollbackSub() {
    await supabase
      .from("client_subscriptions")
      .update({
        end_date: previous.end_date,
        start_date: previous.start_date,
        status: previous.status,
        grace_until: previous.grace_until,
      })
      .eq("id", id)
      .eq("user_id", user.id);
  }

  if (sub?.price && sub.price > 0) {
    const amountReceivedRaw = String(formData.get("amount_received") ?? "").trim();
    const amountReceived = amountReceivedRaw ? parseFloat(amountReceivedRaw) : sub.price;
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
    const effectiveAmount = Math.max(0, Math.min(amountReceived, sub.price));
    let txRow: { id: string } | null = null;
    if (effectiveAmount > 0) {
      const { data: txData, error: txErr } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          kind: "income",
          source: effectiveAmount < sub.price ? "invoice_payment" : "profile_renewal",
          affects_balance: true,
          amount: effectiveAmount,
          client_id: sub.client_id,
          subscription_id: id,
          occurred_on: today,
          label: `Renouvellement ${service} · ${who}`,
        })
        .select("id")
        .single();
      if (txData) txRow = txData;
      if (txErr) {
        await rollbackSub();
        throw new Error(txErr.message ?? "Écriture comptable impossible");
      }
    }
    try {
      const invoice = await createInvoice(supabase, {
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
        amountPaid: effectiveAmount,
      });
      if (invoice?.id && txRow) {
        await supabase.from("transactions").update({ invoice_id: invoice.id }).eq("id", txRow.id).eq("user_id", user.id);
      }
    } catch (err) {
      if (txRow) await supabase.from("transactions").delete().eq("id", txRow.id).eq("user_id", user.id);
      await rollbackSub();
      throw err;
    }
  }
  if (sub) await recordClientEvent(supabase, { userId: user.id, clientId: sub.client_id, subscriptionId: id, type: "subscription_renewed", title: "Abonnement renouvelé", details: { periodStart: baseDate, periodEnd: newEndDate, amount: sub.price } });

  revalidatePath("/clients");
  revalidatePath("/dashboard");
}

export async function cancelClientSubscription(formData: FormData) {
  const { user } = await requireActiveSeller();

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
  const { user } = await requireActiveSeller();

  const id = req(formData, "id");
  const graceUntil = req(formData, "grace_until");
  const supabase = createSupabaseAdmin();
  await assertSlotNotResold(supabase, user.id, id);

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
  const { user } = await requireActiveSeller();

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

  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("subscription_id", sub.id)
    .eq("user_id", user.id);

  await createInvoice(supabase, {
      userId: user.id,
      clientId: sub.client_id,
      subscriptionId: sub.id,
      amount: sub.price,
      serviceName: service,
      slotLabel,
      periodStart: sub.start_date,
      periodEnd: sub.end_date,
      kind: (count ?? 0) > 0 ? "renewal" : "new",
    clientName: who,
    clientPhone: client?.phone ?? null,
    clientEmail: client?.email ?? null,
    paymentRail: client?.payment_rail ?? null,
  });

  revalidatePath("/clients");
}

export async function removeGraceStatus(formData: FormData) {
  const { user } = await requireActiveSeller();

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
  const { user, profile } = await requireActiveSeller();
  const id = req(formData, "invoice_id");
  const status = req(formData, "status");
  if (status === "cancelled" || status === "refunded") {
    throw new Error("Pour annuler une facture, utilisez Annuler dans le journal (écriture liée).");
  }
  if (status !== "paid") throw new Error("Statut de facture invalide");
  if (!canUseFullCompta(normalizePlan(profile?.plan))) {
    throw new Error("Réservé au pack Pro / Business");
  }
  const db = createSupabaseAdmin();
  const { data: invoice } = await db.from("invoices").select("status").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!invoice) throw new Error("Facture introuvable");
  if (invoice.status === "cancelled" || invoice.status === "refunded") {
    throw new Error("Impossible de remettre une facture annulée en payée sans écriture compensatoire.");
  }
  if (invoice.status === "paid") return;
  const { error } = await db.from("invoices").update({ status }).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/clients"); revalidatePath("/facture", "layout");
}
