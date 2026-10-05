"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveSeller } from "@/lib/authz";
import { addMonths } from "@/lib/dates";
import { currentSlotSubscription } from "@/lib/slots";
import { createInvoice } from "@/lib/invoices";
import { recordClientEvent } from "@/lib/client-events";
import { renewClientSubscription } from "@/app/actions/subscriptions";

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
  const { user } = await requireActiveSeller();

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
  const amountReceivedRaw = String(formData.get("amount_received") ?? "").trim();
  const amountReceived = amountReceivedRaw ? parseFloat(amountReceivedRaw) : price;
  if (!Number.isFinite(amountReceived) || amountReceived < 0 || amountReceived > price) {
    throw new Error("Le montant reçu doit être entre 0 et le prix total");
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
  const receiptInput = formData.get("receipt");
  if (receiptInput instanceof File && receiptInput.size > 0 && (receiptInput.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(receiptInput.type))) {
    throw new Error("Justificatif invalide (image/PDF, 5 Mo maximum).");
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

  const { data: occupyingSubs } = await supabase
    .from("client_subscriptions")
    .select("id, status, end_date, client:clients(first_name, last_name)")
    .eq("slot_id", slotId)
    .eq("user_id", user.id)
    .in("status", ["active", "grace"]);

  const occupyingSub = currentSlotSubscription(occupyingSubs);
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
    if (subError.code === "23505") {
      throw new Error("Ce profil vient d’être pris par une autre vente. Réessayez avec un autre profil.");
    }
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
    let txRow: { id: string } | null = null;
    if (amountReceived > 0) {
      const { data: txData, error: transactionError } = await supabase.from("transactions").insert({
        user_id: user.id,
        kind: "income",
        source: amountReceived < price ? "invoice_payment" : "new_profile",
        affects_balance: true,
        amount: amountReceived,
        client_id: client.id,
        subscription_id: sub.id,
        label: transactionLabel,
      }).select("id").single();
      if (transactionError) {
        await supabase.from("clients").delete().eq("id", client.id).eq("user_id", user.id);
        throw new Error(transactionError.message);
      }
      txRow = txData;
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
      amountPaid: amountReceived,
      });
    } catch (error) {
      await supabase.from("transactions").delete().eq("subscription_id", sub.id).eq("user_id", user.id).in("source", ["new_profile", "invoice_payment"]);
      await supabase.from("client_subscriptions").update({ status: "cancelled" }).eq("id", sub.id).eq("user_id", user.id);
      throw error;
    }
    invoiceCode = result?.code ?? null;
    if (result) {
      if (txRow?.id && result.id) {
        const { error: linkError } = await supabase
          .from("transactions")
          .update({ invoice_id: result.id })
          .eq("id", txRow.id)
          .eq("user_id", user.id);
        if (linkError) throw new Error(`Lien facture/transaction impossible : ${linkError.message}`);
      }
      const paymentReference = opt(formData, "payment_reference");
      const receipt = formData.get("receipt");
      let receiptPath: string | null = null;
      if (receipt instanceof File && receipt.size > 0) {
        const extension = receipt.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
        receiptPath = `${user.id}/${client.id}/${result.code}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("receipts").upload(receiptPath, Buffer.from(await receipt.arrayBuffer()), { contentType: receipt.type, upsert: false });
        if (uploadError) { console.error("[receipt-upload]", uploadError.message); receiptPath = null; }
      }
      await supabase.from("invoices").update({ payment_reference: paymentReference, receipt_url: receiptPath }).eq("code", result.code).eq("user_id", user.id);
    }
    await recordClientEvent(supabase, { userId: user.id, clientId: client.id, subscriptionId: sub.id, type: "sale_created", title: "Nouvel abonnement enregistré", details: { service: serviceName, amount: price, startDate, endDate } });
  }

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/abonnements");
  return { invoiceCode, clientName, clientPhone };
}

type CsvClientRow = { first_name?: string; last_name?: string; phone?: string; email?: string; service?: string; profile?: string; start_date?: string; duration_months?: string | number; price?: string | number; payment_rail?: string; pin_code?: string };

export async function importClientsCsv(rows: CsvClientRow[]) {
  const { user } = await requireActiveSeller();
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) throw new Error("Le fichier doit contenir entre 1 et 100 lignes.");
  const db = createSupabaseAdmin();
  const { data: slots, error } = await db.from("account_slots").select("id,label,slot_number,provider_accounts!inner(user_id,service_name,status)").eq("provider_accounts.user_id", user.id).eq("provider_accounts.status", "active");
  if (error) throw new Error(error.message);
  const results: Array<{ line: number; ok: boolean; message: string }> = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const service = String(row.service ?? "").trim().toLowerCase();
    const profile = String(row.profile ?? "").trim().toLowerCase();
    const slot = (slots ?? []).find((item) => {
      const account = item.provider_accounts as unknown as { service_name: string };
      const label = (item.label || `Profil ${item.slot_number}`).toLowerCase();
      return account.service_name.toLowerCase() === service && label === profile;
    });
    if (!slot) { results.push({ line: index + 2, ok: false, message: "Service ou profil introuvable" }); continue; }
    const fd = new FormData();
    Object.entries({ ...row, slot_id: slot.id }).forEach(([key, value]) => fd.set(key, String(value ?? "")));
    try {
      await addClientWithSubscription(fd);
      results.push({ line: index + 2, ok: true, message: "Client importé" });
    } catch (caught) {
      results.push({ line: index + 2, ok: false, message: caught instanceof Error ? caught.message : "Échec de l’import" });
    }
  }
  revalidatePath("/clients");
  return { imported: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results };
}

export async function archiveClient(clientId: string) {
  const { user } = await requireActiveSeller();
  const db = createSupabaseAdmin();
  const { error } = await db.from("clients").update({ archived_at: new Date().toISOString() }).eq("id", clientId).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  await db.from("client_subscriptions").update({ status: "cancelled", grace_until: null }).eq("client_id", clientId).eq("user_id", user.id).in("status", ["active", "grace"]);
  await recordClientEvent(db, { userId: user.id, clientId, type: "client_archived", title: "Client archivé" });
  revalidatePath("/clients"); revalidatePath("/dashboard"); revalidatePath("/abonnements");
}

export async function mergeClients(sourceClientId: string, targetClientId: string) {
  const { user } = await requireActiveSeller();
  if (!sourceClientId || !targetClientId || sourceClientId === targetClientId) throw new Error("Sélection de fusion invalide");
  const db = createSupabaseAdmin();
  const { error } = await db.rpc("merge_clients_atomic", { p_user: user.id, p_source: sourceClientId, p_target: targetClientId });
  if (error) throw new Error(error.message);
  revalidatePath("/clients"); revalidatePath("/dashboard");
}

export async function restoreArchivedClient(clientId: string) {
  const { user } = await requireActiveSeller();
  const db = createSupabaseAdmin();
  const { error } = await db.from("clients").update({ archived_at: null }).eq("id", clientId).eq("user_id", user.id).not("archived_at", "is", null);
  if (error) throw new Error(error.message);
  await recordClientEvent(db, { userId: user.id, clientId, type: "client_restored", title: "Client restauré depuis les archives" });
  revalidatePath("/clients"); revalidatePath("/clients/archives");
}

export async function updateClientMeta(formData: FormData) {
  const { user } = await requireActiveSeller();

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
  await recordClientEvent(supabase, { userId: user.id, clientId: id, type: "notes_updated", title: "Notes ou moyen de paiement modifiés" });
  revalidatePath("/clients");
}

export async function updateClientDetails(formData: FormData) {
  const { user } = await requireActiveSeller();

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
    const { error: subError } = await supabase
      .from("client_subscriptions")
      .update({ price })
      .eq("id", subscriptionId)
      .eq("user_id", user.id);

    if (subError) throw new Error(subError.message);
  }

  await recordClientEvent(supabase, { userId: user.id, clientId, subscriptionId, type: "client_updated", title: "Informations du client modifiées", details: { amount: price, paymentRail } });

  revalidatePath("/clients");
  revalidatePath("/abonnements");
  revalidatePath("/dashboard");
}

export async function updateClientPin(formData: FormData) {
  const { user } = await requireActiveSeller();

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
  await requireActiveSeller();
  const idsRaw = String(formData.get("ids") ?? "");
  const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return;
  const durationMonths = Math.min(24, Math.max(1, parseInt(String(formData.get("duration_months") ?? "1"), 10) || 1));
  for (const id of ids) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("duration_months", String(durationMonths));
    await renewClientSubscription(fd);
  }
}

export async function bulkCancelSubscriptions(formData: FormData) {
  const { user } = await requireActiveSeller();

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

  if (error || !cancelled) throw new Error(error?.message ?? "Profil introuvable");
  await recordClientEvent(supabase, {
    userId: user.id,
    clientId: cancelled.client_id,
    subscriptionId: id,
    type: "subscription_cancelled",
    title: "Abonnement annulé",
  });

  revalidatePath("/clients");
  revalidatePath("/abonnements");
  revalidatePath("/dashboard");
}

export async function bulkDeleteSubscriptions(formData: FormData) {
  const { user } = await requireActiveSeller();

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
  revalidatePath("/abonnements");
  revalidatePath("/dashboard");
}
