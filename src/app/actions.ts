"use server";

import { revalidatePath } from "next/cache";
import { addDays, toDateInputValue } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { SubscriptionStatus } from "@/lib/types";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function addProviderSubscription(formData: FormData) {
  const serviceName = requiredString(formData, "service_name");
  const startDate = requiredString(formData, "start_date");
  const endDate = addDays(startDate, 30);
  const supabase = createSupabaseAdmin();

  const { error } = await supabase.from("subscriptions").insert({
    kind: "provider",
    service_name: serviceName,
    start_date: startDate,
    end_date: endDate,
    status: "active",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function addClientSubscription(formData: FormData) {
  const firstName = requiredString(formData, "first_name");
  const lastName = requiredString(formData, "last_name");
  const serviceName = requiredString(formData, "service_name");
  const startDate = requiredString(formData, "start_date");
  const endDate = addDays(startDate, 30);
  const supabase = createSupabaseAdmin();

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email: optionalString(formData, "email"),
      phone: optionalString(formData, "phone"),
    })
    .select("id")
    .single();

  if (clientError) {
    throw new Error(clientError.message);
  }

  const { error: subscriptionError } = await supabase
    .from("subscriptions")
    .insert({
      kind: "client",
      service_name: serviceName,
      start_date: startDate,
      end_date: endDate,
      status: "active",
      client_id: client.id,
    });

  if (subscriptionError) {
    throw new Error(subscriptionError.message);
  }

  revalidatePath("/");
}

export async function renewSubscription(formData: FormData) {
  const id = requiredString(formData, "id");
  const currentEndDate = requiredString(formData, "end_date");
  const baseDate =
    new Date(`${currentEndDate}T00:00:00`) > new Date()
      ? currentEndDate
      : toDateInputValue();
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("subscriptions")
    .update({
      start_date: toDateInputValue(),
      end_date: addDays(baseDate, 30),
      status: "active",
      last_notified_on: null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function updateSubscriptionStatus(formData: FormData) {
  const id = requiredString(formData, "id");
  const status = requiredString(formData, "status") as SubscriptionStatus;
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("subscriptions")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}
