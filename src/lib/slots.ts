type SlotSubscription = { status: string; end_date: string };

/** Un client en retard garde sa place jusqu'à son renouvellement ou sa libération (annulation). */
export function occupiesSlot(sub: { status: string }) {
  return sub.status === "active" || sub.status === "grace";
}

export function currentSlotSubscription<T extends SlotSubscription>(subs: T[] | null | undefined): T | null {
  let current: T | null = null;
  for (const sub of subs ?? []) {
    if (!occupiesSlot(sub)) continue;
    if (!current || sub.end_date > current.end_date) current = sub;
  }
  return current;
}

export function countOccupiedSlots(slots: Array<{ client_subscriptions?: SlotSubscription[] | null }>) {
  return slots.filter((slot) => currentSlotSubscription(slot.client_subscriptions) !== null).length;
}
