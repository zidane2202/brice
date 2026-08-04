"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

type Notice = { id: string; type: string; title: string; body: string; url: string; read_at: string | null; created_at: string };

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const unread = items.filter((item) => !item.read_at).length;
  const load = async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (response.ok) setItems((await response.json()).notifications ?? []);
  };
  useEffect(() => { void load(); const timer = setInterval(load, 60000); return () => clearInterval(timer); }, []);
  const read = async (notice: Notice) => {
    if (!notice.read_at) await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notice.id }) });
    setItems((all) => all.map((item) => item.id === notice.id ? { ...item, read_at: new Date().toISOString() } : item));
    setOpen(false); router.push(notice.url);
  };
  const readAll = async () => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    setItems((all) => all.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
  };
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="secondary topbar-notification" title="Notifications" aria-label={`Notifications${unread ? `, ${unread} non lues` : ""}`} onClick={() => { setOpen((value) => !value); if (!open) void load(); }} style={{ position: "relative", width: 30, minHeight: 30, height: 30, padding: 0, justifyContent: "center" }}>
        <Icon name="bell" size={13} />
        {unread > 0 && <span style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, padding: "0 4px", display: "grid", placeItems: "center", borderRadius: 99, background: "var(--sr-danger)", color: "white", fontSize: 9, fontWeight: 700 }}>{Math.min(unread, 9)}{unread > 9 ? "+" : ""}</span>}
      </button>
      {open && <div style={{ position: "absolute", top: 38, right: 0, width: "min(390px, calc(100vw - 24px))", maxHeight: 470, overflow: "auto", padding: 8, borderRadius: 12, border: "1px solid var(--sr-border)", background: "var(--sr-surface)", boxShadow: "0 22px 70px rgba(0,0,0,.55)", zIndex: 110 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 8px 10px" }}><strong style={{ fontSize: 13 }}>Notifications</strong>{unread > 0 && <button type="button" className="secondary" onClick={readAll} style={{ minHeight: 25, height: 25, fontSize: 10 }}>Tout marquer comme lu</button>}</div>
        {items.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: "var(--sr-fg-subtle)", fontSize: 12 }}>Aucune notification pour le moment.</div> : items.map((item) => <button key={item.id} type="button" onClick={() => read(item)} style={{ width: "100%", minHeight: 0, height: "auto", display: "block", padding: 12, marginBottom: 4, textAlign: "left", borderRadius: 8, border: `1px solid ${item.read_at ? "transparent" : "var(--sr-success-border)"}`, background: item.read_at ? "transparent" : "var(--sr-success-bg)", color: "var(--sr-fg)" }}><span style={{ display: "block", fontSize: 12, fontWeight: 600 }}>{item.title}</span><span style={{ display: "block", marginTop: 4, color: "var(--sr-fg-subtle)", fontSize: 11, lineHeight: 1.4 }}>{item.body}</span><span style={{ display: "block", marginTop: 6, color: "var(--sr-fg-disabled)", fontSize: 9 }}>{new Date(item.created_at).toLocaleString("fr-FR")}</span></button>)}
      </div>}
    </div>
  );
}
