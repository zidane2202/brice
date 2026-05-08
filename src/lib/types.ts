export type UserRole = "reseller" | "admin";

export type UserProfile = {
  id: string;
  user_id: string;
  role: UserRole;
  plan: string;
  created_at: string;
};

export type ProviderAccount = {
  id: string;
  user_id: string;
  service_name: string;
  max_slots: number;
  start_date: string;
  end_date: string;
  duration_months: number;
  cost: number | null;
  status: "active" | "inactive";
  created_at: string;
  slots?: AccountSlot[];
};

export type AccountSlot = {
  id: string;
  account_id: string;
  slot_number: number;
  label: string;
  active_subscription?: ClientSubscription | null;
};

export type Client = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export type ClientSubscription = {
  id: string;
  user_id: string;
  slot_id: string;
  client_id: string;
  start_date: string;
  end_date: string;
  duration_months: number;
  price: number | null;
  status: "active" | "cancelled";
  last_notified_on: string | null;
  created_at: string;
  client?: Client | null;
  slot?: AccountSlot & { account?: ProviderAccount } | null;
};
