"use client";

import { useEffect } from "react";

export function PushManager({ enabled = true }: { enabled?: boolean }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, [enabled]);

  return null;
}
