"use client";

import { useEffect } from "react";
import { pushPreference, pushSupported, subscribePush } from "@/lib/push-client";

/** Notifications activées par défaut : abonnement silencieux si déjà autorisé, sinon demande au premier clic. */
export function PushManager({ enabled = true }: { enabled?: boolean }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    if (!enabled || !pushSupported() || pushPreference() === "off") return;
    if (Notification.permission === "denied") return;

    if (Notification.permission === "granted") {
      subscribePush().catch(() => undefined);
      return;
    }

    const askOnFirstClick = () => {
      document.removeEventListener("click", askOnFirstClick, true);
      if (pushPreference() === "off" || Notification.permission !== "default") return;
      subscribePush().catch(() => undefined);
    };
    document.addEventListener("click", askOnFirstClick, true);
    return () => document.removeEventListener("click", askOnFirstClick, true);
  }, [enabled]);

  return null;
}
