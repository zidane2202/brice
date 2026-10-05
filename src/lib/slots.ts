type SlotSubscription = { status: string; end_date: string; grace_until?: string | null };
type SlotAccount = { status: string; end_date: string };

/** Une place est occupée tant que l'abonnement court, ou pendant la grâce ; une fois expiré, elle se libère. */
export function occupiesSlot(sub: SlotSubscription, today: string) {
  if (sub.status === "active") return sub.end_date >= today;
  if (sub.status === "grace") return !sub.grace_until || sub.grace_until >= today;
  return false;
}

export function currentSlotSubscription<T extends SlotSubscription>(subs: T[] | null | undefined, today: string): T | null {
  let current: T | null = null;
  for (const sub of subs ?? []) {
    if (!occupiesSlot(sub, today)) continue;
    if (!current || sub.end_date > current.end_date) current = sub;
  }
  return current;
}

export function countOccupiedSlots(slots: Array<{ client_subscriptions?: SlotSubscription[] | null }>, today: string) {
  return slots.filter((slot) => currentSlotSubscription(slot.client_subscriptions, today) !== null).length;
}

/** Un compte fournisseur désactivé ou échu ne propose aucune place libre. */
export function accountOffersSlots(account: SlotAccount, today: string) {
  return account.status === "active" && account.end_date >= today;
}

/**
 * Le client dépend du compte fournisseur : compte échu ou désactivé ⇒ abonnement expiré, sans grâce possible.
 * Les dates du client sont conservées, il redevient actif si le compte est renouvelé avant sa propre échéance.
 */
export function effectiveSubscription<T extends SlotSubscription>(sub: T, account: SlotAccount | null | undefined, today: string): T {
  if (!account?.end_date || !account.status || sub.status === "cancelled" || accountOffersSlots(account, today)) return sub;
  return {
    ...sub,
    status: "expired",
    grace_until: null,
    end_date: account.end_date < sub.end_date ? account.end_date : sub.end_date,
  };
}

type SubWithAccount = SlotSubscription & { slot?: { account?: Partial<SlotAccount> | null } | null };

export function withAccountRule<T extends SubWithAccount>(sub: T, today: string): T {
  const account = sub.slot?.account;
  return effectiveSubscription(sub, account?.status && account.end_date ? (account as SlotAccount) : null, today);
}

/** Client payé au-delà de l'échéance du compte : il perdra son accès si le compte n'est pas renouvelé. */
export function paidBeyondAccount(sub: SlotSubscription, account: SlotAccount, today: string) {
  return occupiesSlot(sub, today) && sub.end_date > account.end_date;
}
