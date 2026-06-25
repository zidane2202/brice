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
  label: string | null;
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

export type PaymentRail = "MTN MoMo" | "Orange Money" | "Wave" | "Visa" | "Mastercard" | "Cash";

export type Client = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  payment_rail: string | null;
  notes: string | null;
  pin_code: string | null;
  created_at: string;
};

export type TransactionKind = "income" | "outflow";
export type TransactionSource = "new_profile" | "profile_renewal" | "account_renewal";
export type TransactionFunding = "balance" | "personal";

export type Transaction = {
  id: string;
  user_id: string;
  kind: TransactionKind;
  source: TransactionSource;
  funded_by: TransactionFunding | null;
  affects_balance: boolean;
  amount: number;
  client_id: string | null;
  subscription_id: string | null;
  account_id: string | null;
  label: string;
  created_at: string;
};

export type Invoice = {
  id: string;
  user_id: string;
  number: number;
  code: string;
  client_id: string | null;
  subscription_id: string | null;
  amount: number;
  service_name: string;
  service_slot: string | null;
  period_start: string;
  period_end: string;
  kind: "new" | "renewal";
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  payment_rail: string | null;
  reseller_name: string | null;
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
  status: "active" | "cancelled" | "grace";
  grace_until: string | null;
  last_notified_on: string | null;
  created_at: string;
  client?: Client | null;
  slot?: AccountSlot & { account?: ProviderAccount } | null;
};

