export type PushState = "loading" | "unsupported" | "blocked" | "inactive" | "active";

const PREF_KEY = "sr-push-pref";
export const PUSH_CHANGE_EVENT = "subresell:push-change";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** "off" = le vendeur a désactivé lui-même ; sinon les notifications sont activées par défaut. */
export function pushPreference(): "on" | "off" | null {
  const value = window.localStorage.getItem(PREF_KEY);
  return value === "on" || value === "off" ? value : null;
}

export function setPushPreference(value: "on" | "off") {
  window.localStorage.setItem(PREF_KEY, value);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(message)), ms))]);
}

async function registration() {
  await navigator.serviceWorker.register("/sw.js");
  return withTimeout(navigator.serviceWorker.ready, 10_000, "Le service de notifications ne répond pas. Rechargez la page.");
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await registration();
  const subscription = await reg.pushManager.getSubscription();
  return subscription && Notification.permission === "granted" ? "active" : "inactive";
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from([...atob(base64)].map((char) => char.charCodeAt(0)));
}

export class PushPermissionError extends Error {
  constructor(public readonly state: "blocked" | "dismissed") {
    super(state === "blocked" ? "Notifications bloquées par le navigateur." : "La demande d'autorisation a été fermée sans réponse.");
  }
}

/** Demande l'autorisation si besoin, abonne l'appareil et l'enregistre côté serveur. */
export async function subscribePush(): Promise<void> {
  if (!pushSupported()) throw new Error("Ce navigateur ne prend pas en charge les notifications.");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Les notifications ne sont pas configurées sur ce serveur.");
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission === "denied") throw new PushPermissionError("blocked");
  if (permission !== "granted") throw new PushPermissionError("dismissed");
  const reg = await registration();
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Impossible d'enregistrer cet appareil.");
  }
  window.dispatchEvent(new Event(PUSH_CHANGE_EVENT));
}

export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await registration();
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
  window.dispatchEvent(new Event(PUSH_CHANGE_EVENT));
}
