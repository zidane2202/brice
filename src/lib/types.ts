export type SubscriptionKind = "provider" | "client";
export type SubscriptionStatus = "active" | "cancelled";

export type Client = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export type Subscription = {
  id: string;
  kind: SubscriptionKind;
  service_name: string;
  start_date: string;
  end_date: string;
  status: SubscriptionStatus;
  client_id: string | null;
  created_at: string;
  client?: Client | null;
};
