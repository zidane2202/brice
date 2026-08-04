"use client";

import { useState } from "react";

export function RestoreBackup() {
  const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  return <label className="secondary" style={{ minHeight: 30, height: 30, display: "inline-flex", alignItems: "center", padding: "0 12px", cursor: "pointer", fontSize: ".78rem" }}>{pending ? "Restauration…" : "Restaurer"}<input type="file" accept="application/json,.json" hidden disabled={pending} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setPending(true); setMessage(""); try { const response = await fetch("/api/account/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: await file.text() }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setMessage(`${result.restored} élément(s) restauré(s). Actualisation…`); window.location.reload(); } catch (error) { setMessage(error instanceof Error ? error.message : "Restauration impossible"); } finally { setPending(false); } }} />{message && <span style={{ position: "absolute", marginTop: 54, right: 20, color: "var(--sr-fg-subtle)" }}>{message}</span>}</label>;
}
