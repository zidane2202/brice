"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { ClientCsvImportModal, downloadImportCsv } from "@/components/clients/ClientCsvImport";
import { toImportCsv, type ImportRow } from "@/lib/client-import";

type Turn =
  | { role: "user"; content: string; files: string[] }
  | { role: "assistant"; content: string; rows?: ImportRow[]; filename?: string };

const WELCOME =
  "Envoyez-moi votre liste de clients, sous n'importe quelle forme : texte collé, capture d'écran, photo, PDF, Excel, Word ou contacts. Je la convertis en fichier CSV prêt à importer. Les champs manquants restent vides.";

const MAX_FILES = 5;
const MAX_BYTES = 4 * 1024 * 1024;

function csvFilename() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `clients-import-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.csv`;
}

export function ClientImportAssistant() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, pending, open]);

  function addFiles(list: FileList | File[]) {
    setError("");
    const next = [...files, ...Array.from(list)].slice(0, MAX_FILES);
    if (next.reduce((total, file) => total + file.size, 0) > MAX_BYTES) {
      setError("Fichiers trop lourds : 4 Mo maximum au total. Envoyez-les en plusieurs fois.");
      return;
    }
    setFiles(next);
  }

  async function send() {
    const text = input.trim();
    if ((!text && files.length === 0) || pending) return;
    setError("");
    const history = turns.map((turn) => ({
      role: turn.role,
      content:
        turn.role === "assistant" && turn.rows?.length
          ? `${turn.content}\n\nCSV généré :\n${toImportCsv(turn.rows)}`
          : turn.role === "user" && turn.files.length
            ? `${turn.content}\n[Fichiers envoyés : ${turn.files.join(", ")}]`.trim()
            : turn.content,
    }));
    const body = new FormData();
    body.set("message", text);
    body.set("history", JSON.stringify(history));
    files.forEach((file) => body.append("files", file));

    setTurns((prev) => [...prev, { role: "user", content: text, files: files.map((file) => file.name) }]);
    setInput("");
    setFiles([]);
    setPending(true);
    try {
      const res = await fetch("/api/clients/import-assistant", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; rows?: ImportRow[]; error?: string };
      if (!res.ok || !data.reply) throw new Error(data.error || "L'assistant n'a pas pu traiter la liste.");
      const rows = data.rows ?? [];
      const filename = rows.length ? csvFilename() : undefined;
      if (rows.length && filename) downloadImportCsv(rows, filename);
      setTurns((prev) => [...prev, { role: "assistant", content: data.reply!, rows, filename }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        <Icon name="zap" size={14} /> Assistant d&apos;import
      </button>

      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1200, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.72)", backdropFilter: "blur(5px)" }}
          onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Assistant d'import de clients"
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files); }}
            style={{ width: "min(720px, 100%)", height: "min(680px, 88vh)", display: "flex", flexDirection: "column", borderRadius: 14, border: `1px solid ${dragging ? "var(--sr-mint-500)" : "var(--sr-border)"}`, background: "var(--sr-surface)", overflow: "hidden" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "18px 20px", borderBottom: "1px solid var(--sr-border-subtle)" }}>
              <div>
                <h2 style={{ margin: 0 }}>Assistant d&apos;import</h2>
                <p style={{ margin: "4px 0 0", color: "var(--sr-fg-subtle)", fontSize: 12 }}>
                  Je transforme votre liste en CSV. Vérifiez-le, puis importez-le.
                </p>
              </div>
              <button type="button" className="secondary" onClick={() => setOpen(false)} aria-label="Fermer" disabled={pending}><Icon name="x" size={14} /></button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "grid", alignContent: "start", gap: 12 }}>
              <Bubble role="assistant">{WELCOME}</Bubble>
              {turns.map((turn, index) =>
                turn.role === "user" ? (
                  <Bubble key={index} role="user">
                    {turn.content}
                    {turn.files.length > 0 && (
                      <div style={{ marginTop: turn.content ? 6 : 0, fontSize: 11, opacity: 0.8 }}>{turn.files.map((name) => `📎 ${name}`).join("  ")}</div>
                    )}
                  </Bubble>
                ) : (
                  <Bubble key={index} role="assistant">
                    {turn.content}
                    {turn.rows && turn.rows.length > 0 && turn.filename && (
                      <div style={{ marginTop: 10, padding: 10, borderRadius: 8, border: "1px solid var(--sr-border-subtle)", background: "var(--sr-bg)", display: "grid", gap: 8 }}>
                        <span style={{ fontSize: 12 }}>
                          <Icon name="bill" size={13} /> <strong data-no-i18n>{turn.filename}</strong>
                          {` · ${turn.rows.length} client(s) trouvé(s)`}
                        </span>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="secondary" onClick={() => downloadImportCsv(turn.rows!, turn.filename!)}>
                            <Icon name="download" size={14} /> Télécharger le CSV
                          </button>
                          <button type="button" onClick={() => setImportRows(turn.rows!)}>
                            <Icon name="check" size={14} /> Vérifier et importer
                          </button>
                        </div>
                      </div>
                    )}
                  </Bubble>
                )
              )}
              {pending && <Bubble role="assistant">Lecture de la liste en cours…</Bubble>}
              {error && <p style={{ margin: 0, color: "var(--sr-danger)", fontSize: 12 }}>{error}</p>}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={(event) => { event.preventDefault(); void send(); }}
              style={{ padding: 14, borderTop: "1px solid var(--sr-border-subtle)", display: "grid", gap: 8 }}
            >
              {files.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {files.map((file, index) => (
                    <span key={`${file.name}-${index}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 999, border: "1px solid var(--sr-border-subtle)", fontSize: 11 }}>
                      <span data-no-i18n>{file.name}</span>
                      <button type="button" aria-label="Retirer le fichier" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))} style={{ all: "unset", cursor: "pointer", lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <button type="button" className="secondary" onClick={() => fileInput.current?.click()} disabled={pending || files.length >= MAX_FILES} aria-label="Joindre un fichier">
                  <Icon name="upload" size={14} />
                </button>
                <input ref={fileInput} type="file" multiple hidden onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
                  onPaste={(event) => { if (event.clipboardData.files.length) { event.preventDefault(); addFiles(event.clipboardData.files); } }}
                  placeholder="Collez votre liste, déposez un fichier ou demandez une correction…"
                  rows={2}
                  maxLength={20000}
                  disabled={pending}
                  style={{ flex: 1, resize: "none" }}
                />
                <button type="submit" className="primary" disabled={pending || (!input.trim() && files.length === 0)} aria-label="Envoyer">
                  <Icon name="send" size={14} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ClientCsvImportModal open={importRows !== null} onClose={() => setImportRows(null)} initialRows={importRows ?? undefined} />
    </>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const mine = role === "user";
  return (
    <div
      style={{
        justifySelf: mine ? "end" : "start",
        maxWidth: "85%",
        padding: "10px 12px",
        borderRadius: 12,
        fontSize: 13,
        lineHeight: 1.45,
        whiteSpace: "pre-wrap",
        background: mine ? "rgba(41,220,133,.14)" : "var(--sr-bg)",
        border: `1px solid ${mine ? "rgba(41,220,133,.35)" : "var(--sr-border-subtle)"}`,
      }}
    >
      {children}
    </div>
  );
}
