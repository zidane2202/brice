"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type PushState = "loading" | "unsupported" | "blocked" | "inactive" | "active";

export function NotificationSettings({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshState();
  }, []);

  async function refreshState() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.getSubscription();
    setState(subscription ? "active" : "inactive");
  }

  async function activate() {
    setBusy(true);
    setMessage(null);
    try {
      if (!enabled) throw new Error("Les notifications sont disponibles avec les packs Pro et Business.");
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Les notifications ne sont pas configurées sur ce serveur.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "inactive");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) throw new Error("Impossible d’enregistrer cet appareil.");
      setState("active");
      setMessage("Notifications activées sur cet appareil.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("inactive");
      setMessage("Notifications désactivées sur cet appareil.");
    } finally {
      setBusy(false);
    }
  }

  const labels: Record<PushState, string> = {
    loading: "Vérification…",
    unsupported: "Non compatible",
    blocked: "Bloquées par le navigateur",
    inactive: "Désactivées",
    active: "Activées",
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <Icon name="bell" size={16} /> Notifications push
          </div>
          <p style={{ margin: "6px 0 0", color: "var(--sr-fg-subtle)", fontSize: 12 }}>
            Rappels clients à J−3, échéance du pack et suspension. L’autorisation est demandée uniquement après votre clic.
          </p>
        </div>
        <span className={`status ${state === "active" ? "active" : state === "blocked" ? "cancelled" : "grace"}`}>
          {labels[state]}
        </span>
        {state === "active" ? (
          <button type="button" className="secondary" onClick={deactivate} disabled={busy}>Désactiver</button>
        ) : (
          <button type="button" onClick={activate} disabled={busy || state === "unsupported" || state === "blocked" || !enabled}>
            {busy ? "Activation…" : "Activer les notifications"}
          </button>
        )}
      </div>
      {state === "blocked" && (
        <p style={{ color: "var(--sr-warning)", fontSize: 12 }}>
          Autorisez les notifications dans les paramètres du navigateur, puis rechargez la page.
        </p>
      )}
      {message && <p style={{ color: state === "active" ? "var(--sr-mint-300)" : "var(--sr-fg-muted)", fontSize: 12 }}>{message}</p>}
    </div>
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from([...atob(base64)].map((char) => char.charCodeAt(0)));
}
