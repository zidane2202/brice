"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallButton() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
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

  if (installed) return null;

  async function handleInstall() {
    if (!prompt) {
      router.push("/profil#section-application");
      return;
    }
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  return (
    <button
      type="button"
      className="secondary topbar-install"
      onClick={handleInstall}
      title="Installer l’application"
      style={{ minHeight: 30, height: 30, padding: "0 10px", fontSize: 11 }}
    >
      <Icon name="download" size={13} />
      <span>Installer</span>
    </button>
  );
}
