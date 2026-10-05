"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  currentPushState,
  PUSH_CHANGE_EVENT,
  PushPermissionError,
  pushPreference,
  setPushPreference,
  subscribePush,
  unsubscribePush,
  type PushState,
} from "@/lib/push-client";

const LABELS: Record<PushState, string> = {
  loading: "Vérification…",
  unsupported: "Non compatible",
  blocked: "Bloquées par le navigateur",
  inactive: "Désactivées",
  active: "Activées",
};

export function NotificationSettings({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [optedOut, setOptedOut] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setOptedOut(pushPreference() === "off");
      currentPushState()
        .then(setState)
        .catch((error) => {
          setState("inactive");
          setMessage(error instanceof Error ? error.message : null);
        });
    };
    refresh();
    window.addEventListener(PUSH_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(PUSH_CHANGE_EVENT, refresh);
  }, []);

  async function activate() {
    setMessage(null);
    setHelp(false);
    if (!enabled) {
      setMessage("Les notifications sont incluses dans l'essai gratuit et les packs Pro et Business. Votre compte est en lecture seule : passez à Pro ou Business pour les activer.");
      return;
    }
    setBusy(true);
    try {
      setPushPreference("on");
      setOptedOut(false);
      await subscribePush();
      setState("active");
      setMessage("Notifications activées sur cet appareil.");
    } catch (error) {
      if (error instanceof PushPermissionError) {
        setState(error.state === "blocked" ? "blocked" : "inactive");
        setHelp(true);
        setMessage(
          error.state === "blocked"
            ? "Votre navigateur bloque les notifications pour ce site."
            : "Le navigateur n'a pas affiché la demande ou elle a été fermée."
        );
      } else {
        setMessage(error instanceof Error ? error.message : "Une erreur est survenue.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    setMessage(null);
    try {
      setPushPreference("off");
      setOptedOut(true);
      await unsubscribePush();
      setState("inactive");
      setMessage("Notifications désactivées sur cet appareil. Vous pouvez les réactiver à tout moment.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <Icon name="bell" size={16} /> Notifications push
          </div>
          <p style={{ margin: "6px 0 0", color: "var(--sr-fg-subtle)", fontSize: 12 }}>
            Rappels clients à J−3, fin d&apos;essai et échéance du pack. Activées par défaut ; vous pouvez les désactiver ou les réactiver ici.
          </p>
        </div>
        <span className={`status ${state === "active" ? "active" : state === "blocked" ? "cancelled" : "grace"}`}>
          {LABELS[state]}
        </span>
        {state === "active" ? (
          <button type="button" className="secondary" onClick={deactivate} disabled={busy}>
            {busy ? "Désactivation…" : "Désactiver"}
          </button>
        ) : state === "blocked" ? (
          <button type="button" className="secondary" onClick={() => setHelp((value) => !value)}>
            Comment les débloquer
          </button>
        ) : (
          <button type="button" onClick={activate} disabled={busy || state === "unsupported" || state === "loading"}>
            {busy ? "Activation…" : optedOut ? "Réactiver les notifications" : "Activer les notifications"}
          </button>
        )}
      </div>
      {state === "unsupported" && (
        <p style={{ color: "var(--sr-fg-muted)", fontSize: 12 }}>
          Ce navigateur ne gère pas les notifications. Sur iPhone, installez d&apos;abord l&apos;application sur l&apos;écran d&apos;accueil (Partager → Sur l&apos;écran d&apos;accueil).
        </p>
      )}
      {message && <p style={{ color: state === "active" ? "var(--sr-mint-300)" : "var(--sr-fg-muted)", fontSize: 12 }}>{message}</p>}
      {(help || state === "blocked") && (
        <ol style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--sr-fg-muted)", fontSize: 12, lineHeight: 1.6 }}>
          <li>Cliquez sur l&apos;icône à gauche de l&apos;adresse du site (cadenas ou réglages).</li>
          <li>Dans « Notifications », choisissez « Autoriser ».</li>
          <li>Rechargez la page, puis cliquez sur « Activer les notifications ».</li>
        </ol>
      )}
    </div>
  );
}
