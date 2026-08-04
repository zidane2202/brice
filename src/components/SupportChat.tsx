"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const WELCOME =
  "Bonjour et bienvenue sur le support SubResell 👋 Comment pouvons-nous vous aider aujourd’hui ?";

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: WELCOME },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, pending]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    setError(null);
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setPending(true);
    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.filter((m, i) => !(i === 0 && m.role === "assistant")),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        throw new Error(data.error || "Erreur support");
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply! }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="support-chat">
      {open && (
        <div className="support-chat-panel" role="dialog" aria-label="Support SubResell">
          <div className="support-chat-head">
            <div>
              <strong>Support</strong>
              <p>Service client SubResell</p>
            </div>
            <button
              type="button"
              className="support-chat-close"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>

          <div className="support-chat-messages">
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`support-chat-bubble support-chat-bubble--${m.role}`}
              >
                {m.content}
              </div>
            ))}
            {pending && (
              <div className="support-chat-bubble support-chat-bubble--assistant support-chat-typing">
                …
              </div>
            )}
            {error && <p className="support-chat-error">{error}</p>}
            <div ref={bottomRef} />
          </div>

          <form
            className="support-chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Votre question…"
              disabled={pending}
              maxLength={2000}
              aria-label="Message"
            />
            <button type="submit" className="primary" disabled={pending || !input.trim()}>
              Envoyer
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="support-chat-fab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Fermer le support" : "Ouvrir le support"}
      >
        {open ? "×" : "?"}
      </button>
    </div>
  );
}
