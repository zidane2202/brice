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
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw ? parseFloat(priceRaw) : NaN;
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Le montant payé par le client est obligatoire");
  }
  const endDate = addMonths(startDate, durationMonths);

  const supabase = createSupabaseAdmin();

  const phone = opt(formData, "phone");
  const email = opt(formData, "email");
  if (phone || email) {
    let duplicateQuery = supabase
      .from("clients")
      .select("id, first_name, last_name, phone, email")
      .eq("user_id", user.id);
    duplicateQuery = phone
      ? duplicateQuery.eq("phone", phone)
      : duplicateQuery.ilike("email", email!);
    const { data: duplicate } = await duplicateQuery.limit(1).maybeSingle();
    if (duplicate) {
      const duplicateName = [duplicate.first_name, duplicate.last_name].filter(Boolean).join(" ");
      throw new Error(`Un client existe déjà avec ${phone ? "ce numéro" : "cet e-mail"} (${duplicateName}). Ouvrez sa fiche au lieu de créer un doublon.`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 24) {
    throw new Error("Date ou durée invalide (1 à 24 mois).");
  }

  // Verify the slot belongs to an account owned by this user
  const { data: slot } = await supabase
    .from("account_slots")
    .select("id, account_id, provider_accounts(user_id, service_name)")
    .eq("id", slotId)
    .single();

  const account = slot?.provider_accounts as unknown as { user_id: string; service_name: string } | null;
  const accountOwner = account?.user_id;
  if (!slot || accountOwner !== user.id) throw new Error("Slot invalide");

  const today = toDateInputValue();
  const { data: occupyingSubs } = await supabase
    .from("client_subscriptions")
    .select("id, status, end_date, client:clients(first_name, last_name)")
    .eq("slot_id", slotId)
    .eq("user_id", user.id)
    .in("status", ["active", "grace"]);

  const occupyingSub = (occupyingSubs ?? []).find((s) =>
    s.status === "grace" || (s.status === "active" && s.end_date >= today)
  );
  if (occupyingSub) {
    const existingClient = occupyingSub.client as unknown as { first_name?: string; last_name?: string | null } | null;
    const existingName = [existingClient?.first_name, existingClient?.last_name].filter(Boolean).join(" ") || "un client";
    throw new Error(`Ce profil est déjà occupé par ${existingName}. Action annulée.`);
  }

  const clientName = [firstName, lastName].filter(Boolean).join(" ");
  const serviceNameForDuplicate = account?.service_name ?? "Profil";
  const transactionLabel = `Vente ${serviceNameForDuplicate} — ${clientName}`;
  const recentCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recentDuplicate } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "income")
    .eq("source", "new_profile")
    .eq("amount", price)
    .eq("label", transactionLabel)
    .gte("created_at", recentCutoff)
    .limit(1);

  if ((recentDuplicate ?? []).length > 0) {
    throw new Error("Action identique opérée à l’instant. Attendez quelques secondes avant de réessayer.");
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
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

  if (subError) {
    await supabase.from("clients").delete().eq("id", client.id).eq("user_id", user.id);
    throw new Error(subError.message);
  }

  const clientPhone = phone;
  let invoiceCode: string | null = null;

  if (sub) {
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
    const { error: transactionError } = await supabase.from("transactions").insert({
      user_id: user.id,
      kind: "income",
      source: "new_profile",
      affects_balance: true,
      amount: price,
      client_id: client.id,
      subscription_id: sub.id,
      label: transactionLabel,
    });
    if (transactionError) {
      await supabase.from("clients").delete().eq("id", client.id).eq("user_id", user.id);
      throw new Error(transactionError.message);
    }
    let result;
    try {
      result = await createInvoice(supabase, {
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
      clientEmail: email,
      paymentRail: opt(formData, "payment_rail"),
      });
    } catch (error) {
      await supabase.from("transactions").delete().eq("subscription_id", sub.id).eq("user_id", user.id);
      await supabase.from("clients").delete().eq("id", client.id).eq("user_id", user.id);
      throw error;
    }
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

export async function updateClientDetails(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const clientId = req(formData, "id");
  const subscriptionId = opt(formData, "subscription_id");
  const firstName = req(formData, "first_name");
  const lastName = opt(formData, "last_name");
  const email = opt(formData, "email");
  const phone = opt(formData, "phone");
  const pinCode = opt(formData, "pin_code");
  const paymentRail = opt(formData, "payment_rail");
  const notes = opt(formData, "notes");
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw ? parseFloat(priceRaw) : null;

  if (priceRaw && (!Number.isFinite(price) || (price ?? 0) <= 0)) {
    throw new Error("Le montant payé doit être supérieur à 0");
  }

  const supabase = createSupabaseAdmin();
  const { error: clientError } = await supabase
    .from("clients")
    .update({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      pin_code: pinCode,
      payment_rail: paymentRail,
      notes,
    })
    .eq("id", clientId)
    .eq("user_id", user.id);

  if (clientError) throw new Error(clientError.message);

  if (subscriptionId && price) {
    const { data: sub } = await supabase
      .from("client_subscriptions")
      .select("id, slot:account_slots(account:provider_accounts(service_name))")
      .eq("id", subscriptionId)
      .eq("user_id", user.id)
      .single();

    const serviceName =
      ((sub?.slot as unknown as { account?: { service_name?: string } } | null)?.account?.service_name) ?? "Profil";
    const clientName = [firstName, lastName].filter(Boolean).join(" ");
    const label = `Vente ${serviceName} — ${clientName}`;

    const { error: subError } = await supabase
      .from("client_subscriptions")
      .update({ price })
      .eq("id", subscriptionId)
      .eq("user_id", user.id);

    if (subError) throw new Error(subError.message);

    await supabase
      .from("transactions")
      .update({ amount: price, label })
      .eq("subscription_id", subscriptionId)
      .eq("user_id", user.id)
      .eq("source", "new_profile");

    await supabase
      .from("invoices")
      .update({
        amount: price,
        client_name: clientName,
        client_phone: phone,
        client_email: email,
        payment_rail: paymentRail,
      })
      .eq("subscription_id", subscriptionId)
      .eq("user_id", user.id)
      .eq("kind", "new");
  }

  revalidatePath("/clients");
  revalidatePath("/abonnements");
  revalidatePath("/dashboard");
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
        label: `Renouvellement ${service} · ${who}`,
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

export async function deleteClientSubscription(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const supabase = createSupabaseAdmin();

  const { data: sub, error: subError } = await supabase
    .from("client_subscriptions")
    .select("id, client_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (subError || !sub) throw new Error("Profil introuvable");

  const clientId = sub.client_id as string;

  await supabase
    .from("transactions")
    .delete()
    .eq("subscription_id", id)
    .eq("user_id", user.id);

  await supabase
    .from("invoices")
    .delete()
    .eq("subscription_id", id)
    .eq("user_id", user.id);

  const { error: deleteError } = await supabase
    .from("client_subscriptions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) throw new Error(deleteError.message);

  const { count } = await supabase
    .from("client_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("user_id", user.id);

  if ((count ?? 0) === 0) {
    const { error: clientError } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId)
      .eq("user_id", user.id);

    if (clientError) throw new Error(clientError.message);
  }

  revalidatePath("/clients");
  revalidatePath("/abonnements");
  revalidatePath("/dashboard");
}

export async function bulkDeleteSubscriptions(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const idsRaw = String(formData.get("ids") ?? "");
  const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return;

  const supabase = createSupabaseAdmin();

  const { data: subs, error: subError } = await supabase
    .from("client_subscriptions")
    .select("id, client_id")
    .in("id", ids)
    .eq("user_id", user.id);

  if (subError) throw new Error(subError.message);
  if (!subs || subs.length === 0) return;

  const clientIds = Array.from(new Set(subs.map((s) => s.client_id as string).filter(Boolean)));
  const subIds = subs.map((s) => s.id as string);

  await supabase
    .from("transactions")
    .delete()
    .in("subscription_id", subIds)
    .eq("user_id", user.id);

  await supabase
    .from("invoices")
    .delete()
    .in("subscription_id", subIds)
    .eq("user_id", user.id);

  const { error: deleteError } = await supabase
    .from("client_subscriptions")
    .delete()
    .in("id", subIds)
    .eq("user_id", user.id);

  if (deleteError) throw new Error(deleteError.message);

  for (const clientId of clientIds) {
    const { count } = await supabase
      .from("client_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("user_id", user.id);

    if ((count ?? 0) === 0) {
      const { error: clientError } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId)
        .eq("user_id", user.id);

      if (clientError) throw new Error(clientError.message);
    }
  }

  revalidatePath("/clients");
  revalidatePath("/abonnements");
  revalidatePath("/dashboard");
}
