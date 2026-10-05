type SlotSubscription = { status: string; end_date: string; grace_until?: string | null };

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
export function accountOffersSlots(account: { status: string; end_date: string }, today: string) {
  return account.status === "active" && account.end_date >= today;
}
