"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  return (
    <div style={{ padding: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ width: 48, height: 48, display: "grid", placeItems: "center", borderRadius: 12, background: "rgba(41,220,133,.12)", color: "var(--sr-mint-300)" }}>
        <Icon name="download" size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <strong>{installed ? "Application installée" : "Installer SubResell"}</strong>
        <p style={{ margin: "5px 0 0", color: "var(--sr-fg-subtle)", fontSize: 12, lineHeight: 1.45 }}>
          {installed
            ? "SubResell fonctionne désormais comme une application sur cet appareil."
            : isIos
              ? "Sur iPhone ou iPad : touchez Partager, puis « Sur l’écran d’accueil »."
              : prompt
                ? "Ajoutez SubResell à votre écran d’accueil pour un accès rapide et une expérience plein écran."
                : "Dans le menu de votre navigateur, choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil »."}
        </p>
      </div>
      {!installed && prompt && <button type="button" onClick={install}>Installer l’application</button>}
      {installed && <span className="status active">Installée</span>}
    </div>
  );
}
