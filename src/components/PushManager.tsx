"use client";

import { useMemo, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function PushManager() {
  const [message, setMessage] = useState("Notifications non activees");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const canUsePush = useMemo(
    () =>
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      Boolean(publicKey),
    [publicKey],
  );

  async function enableNotifications() {
    if (!canUsePush || !publicKey) {
      setMessage("Ajoute NEXT_PUBLIC_VAPID_PUBLIC_KEY dans Vercel.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      setMessage("Permission refusee par le navigateur.");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });

    setMessage(
      response.ok
        ? "Notifications activees pour les rappels J-3 a J."
        : "Impossible d'enregistrer cette notification.",
    );
  }

  return (
    <div className="notice">
      <div>
        <strong>Rappels push</strong>
        <span>{message}</span>
      </div>
      <button type="button" onClick={enableNotifications}>
        Activer
      </button>
    </div>
  );
}
