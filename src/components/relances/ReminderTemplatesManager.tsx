"use client";

import { useEffect, useRef, useState } from "react";
import { deleteReminderTemplate, saveReminderTemplate } from "@/app/actions/reminders";
import { Icon } from "@/components/Icon";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  PRESET_TEMPLATES,
  REMINDER_CATEGORIES,
  REMINDER_VARIABLES,
  renderReminder,
  type ReminderTemplate,
} from "@/lib/reminder-templates";

type Props = {
  templates: ReminderTemplate[];
  unavailable: boolean;
  sellerName: string;
  onClose: () => void;
};

type Draft = { id: string; name: string; category: string; body: string };

const EMPTY: Draft = { id: "", name: "", category: "all", body: "" };

const categoryLabel = (id: string) =>
  id === "all" ? "Toutes les catégories" : REMINDER_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export function ReminderTemplatesManager({ templates, unavailable, sellerName, onClose }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const sample: Record<string, string> = {
    prenom: "Aïcha",
    nom: "Mbarga",
    service: "Netflix",
    date_fin: "08/10/2026",
    jours: "3",
    prix: "3 000",
    reste_du: "1 500",
    vendeur: sellerName || "Votre vendeur",
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function insertVariable(key: string) {
    if (!draft) return;
    const token = `{${key}}`;
    const area = bodyRef.current;
    const start = area?.selectionStart ?? draft.body.length;
    const end = area?.selectionEnd ?? draft.body.length;
    const body = draft.body.slice(0, start) + token + draft.body.slice(end);
    setDraft({ ...draft, body });
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mes messages de relance"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 1200, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.72)" }}
    >
      <div style={{ width: "min(720px,100%)", maxHeight: "90vh", overflowY: "auto", padding: 22, borderRadius: 14, background: "var(--sr-surface)", border: "1px solid var(--sr-border-strong)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <h3 style={{ margin: 0, flex: 1 }}>Mes messages de relance</h3>
          <button type="button" className="secondary" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={14} />
          </button>
        </div>

        {unavailable && (
          <p style={{ color: "var(--sr-danger)", fontSize: 12 }}>
            Table des messages absente : exécutez supabase/reminder-templates.sql dans Supabase.
          </p>
        )}

        {!draft && (
          <>
            <div style={{ display: "grid", gap: 8 }}>
              {templates.map((template) => (
                <div key={template.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 12, border: "1px solid var(--sr-border-subtle)", borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{template.name}</strong>
                    <span style={{ marginLeft: 8, fontSize: 11, color: "var(--sr-fg-subtle)" }}>{categoryLabel(template.category)}</span>
                    <p data-no-i18n style={{ margin: "6px 0 0", fontSize: 12, color: "var(--sr-fg-muted)", whiteSpace: "pre-wrap" }}>{template.body}</p>
                  </div>
                  <button type="button" className="secondary" onClick={() => setDraft({ id: template.id, name: template.name, category: template.category, body: template.body })}>
                    Modifier
                  </button>
                  <ActionForm
                    action={deleteReminderTemplate}
                    successMessage="Message supprimé"
                    errorMessage="Suppression impossible"
                    confirm={{ title: "Supprimer ce message ?", confirmLabel: "Supprimer", tone: "danger" }}
                    style={{ margin: 0 }}
                  >
                    <input type="hidden" name="id" value={template.id} />
                    <SubmitButton className="secondary">Supprimer</SubmitButton>
                  </ActionForm>
                </div>
              ))}
              {!templates.length && (
                <p style={{ color: "var(--sr-fg-subtle)", fontSize: 13 }}>
                  Aucun message personnalisé. Les messages prédéfinis restent disponibles dans chaque catégorie.
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button type="button" className="primary" onClick={() => setDraft(EMPTY)} disabled={unavailable}>
                <Icon name="plus" size={14} /> Nouveau message
              </button>
              <select
                value=""
                disabled={unavailable}
                onChange={(event) => {
                  const preset = PRESET_TEMPLATES.find((t) => t.id === event.target.value);
                  if (preset) setDraft({ id: "", name: `${preset.name} (copie)`, category: preset.category, body: preset.body });
                }}
                style={{ maxWidth: 280 }}
              >
                <option value="">Partir d’un message prédéfini…</option>
                {PRESET_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{categoryLabel(t.category)} · {t.name}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {draft && (
          <ActionForm
            action={saveReminderTemplate}
            successMessage="Message enregistré"
            errorMessage="Enregistrement impossible"
            onSuccess={() => setDraft(null)}
          >
            <input type="hidden" name="id" value={draft.id} />
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10 }}>
              <label>
                Nom
                <input name="name" value={draft.name} maxLength={60} required onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex. Rappel amical" />
              </label>
              <label>
                Catégorie
                <select name="category" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                  <option value="all">Toutes les catégories</option>
                  {REMINDER_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0 6px" }}>
              {REMINDER_VARIABLES.map((variable) => (
                <button key={variable.key} type="button" className="secondary" onClick={() => insertVariable(variable.key)} style={{ minHeight: 26, height: 26, fontSize: 11, paddingInline: 8 }}>
                  + {variable.label}
                </button>
              ))}
            </div>
            <label>
              Message
              <textarea
                ref={bodyRef}
                data-no-i18n
                name="body"
                value={draft.body}
                maxLength={1000}
                rows={5}
                required
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                placeholder="Bonjour {prenom}, votre abonnement {service} expire le {date_fin}…"
              />
            </label>
            <p style={{ margin: "10px 0 4px", fontSize: 11, color: "var(--sr-fg-subtle)" }}>Aperçu</p>
            <blockquote data-no-i18n style={{ margin: 0, padding: "10px 12px", borderLeft: "2px solid var(--sr-mint-500)", background: "var(--sr-surface-raised)", color: "var(--sr-fg-muted)", fontSize: 13, whiteSpace: "pre-wrap" }}>
              {renderReminder(draft.body, sample) || "…"}
            </blockquote>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="secondary" onClick={() => setDraft(null)}>Annuler</button>
              <SubmitButton>{draft.id ? "Enregistrer" : "Créer le message"}</SubmitButton>
            </div>
          </ActionForm>
        )}
      </div>
    </div>
  );
}
