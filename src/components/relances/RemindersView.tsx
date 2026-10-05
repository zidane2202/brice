"use client";

import { useMemo, useState, useTransition } from "react";
import { recordReminderSent } from "@/app/actions/reminders";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterPill } from "@/components/ui/FilterPill";
import { useToast } from "@/components/ui/Toast";
import { ReminderTemplatesManager } from "@/components/relances/ReminderTemplatesManager";
import { blockIfPlanExpired } from "@/lib/plan-expired-client";
import {
  REMINDER_CATEGORIES,
  renderReminder,
  templatesFor,
  whatsappUrl,
  type ReminderCategory,
  type ReminderTemplate,
} from "@/lib/reminder-templates";

export type ReminderRow = {
  key: string;
  category: ReminderCategory;
  subscriptionId: string;
  clientId: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  service: string;
  endDate: string;
  days: number;
  price: number;
  balance: number;
  reminderStatus: string | null;
  sentAt: string | null;
};

type Props = {
  rows: ReminderRow[];
  customTemplates: ReminderTemplate[];
  templatesUnavailable: boolean;
  sellerName: string;
};

const fcfa = (value: number) => Math.round(value).toLocaleString("fr-FR").replace(/[\u202F\u00A0]/g, " ");
const frDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR");

function variablesFor(row: ReminderRow, sellerName: string): Record<string, string> {
  return {
    prenom: row.firstName,
    nom: row.lastName ?? "",
    service: row.service,
    date_fin: frDate(row.endDate),
    jours: String(Math.abs(row.days)),
    prix: fcfa(row.price),
    reste_du: fcfa(row.balance),
    vendeur: sellerName,
  };
}

function dueLabel(row: ReminderRow) {
  if (row.category === "balance") return `Reste ${fcfa(row.balance)} FCFA`;
  if (row.category === "grace") return `En grâce jusqu'au ${frDate(row.endDate)}`;
  if (row.days === 0) return "Expire aujourd'hui";
  if (row.days > 0) return `J-${row.days} · ${frDate(row.endDate)}`;
  return `${Math.abs(row.days)} j de retard`;
}

export function RemindersView({ rows, customTemplates, templatesUnavailable, sellerName }: Props) {
  const counts = useMemo(() => {
    const result = Object.fromEntries(REMINDER_CATEGORIES.map((c) => [c.id, 0])) as Record<ReminderCategory, number>;
    for (const row of rows) result[row.category] += 1;
    return result;
  }, [rows]);
  const [category, setCategory] = useState<ReminderCategory>(
    () => REMINDER_CATEGORIES.find((c) => counts[c.id] > 0)?.id ?? "soon3"
  );
  const [managerOpen, setManagerOpen] = useState(false);
  const meta = REMINDER_CATEGORIES.find((c) => c.id === category)!;
  const visible = rows.filter((row) => row.category === category);
  const templates = templatesFor(category, customTemplates);

  return (
    <>
      <div className="page-header" style={{ alignItems: "flex-end" }}>
        <div>
          <p className="eyebrow">Suivi commercial</p>
          <h1>Relances clients</h1>
          <p>Choisissez un message, vérifiez-le, puis envoyez-le sur WhatsApp en un clic.</p>
        </div>
        <button type="button" className="secondary" onClick={() => setManagerOpen(true)}>
          <Icon name="pencil" size={14} /> Mes messages ({customTemplates.length})
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {REMINDER_CATEGORIES.map((c) => (
          <FilterPill
            key={c.id}
            label={c.label}
            count={counts[c.id]}
            active={category === c.id}
            tone={counts[c.id] ? c.tone : "neutral"}
            onClick={() => setCategory(c.id)}
          />
        ))}
      </div>

      <div className="panel reminder-list">
        <p style={{ margin: "0 0 4px", color: "var(--sr-fg-subtle)", fontSize: 12 }}>{meta.description}</p>
        {visible.map((row) => (
          <ReminderCard key={row.key} row={row} templates={templates} sellerName={sellerName} />
        ))}
        {!visible.length && (
          <EmptyState title="Personne à relancer ici" description="Les clients de cette catégorie apparaîtront automatiquement." />
        )}
      </div>

      {managerOpen && (
        <ReminderTemplatesManager
          templates={customTemplates}
          unavailable={templatesUnavailable}
          sellerName={sellerName}
          onClose={() => setManagerOpen(false)}
        />
      )}
    </>
  );
}

function ReminderCard({ row, templates, sellerName }: { row: ReminderRow; templates: ReminderTemplate[]; sellerName: string }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const vars = variablesFor(row, sellerName);
  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const [text, setText] = useState(() => (template ? renderReminder(template.body, vars) : ""));
  const [sentAt, setSentAt] = useState(row.reminderStatus === "sent" ? row.sentAt : null);
  const url = whatsappUrl(row.phone, text);

  function chooseTemplate(id: string) {
    setTemplateId(id);
    const next = templates.find((t) => t.id === id);
    if (next) setText(renderReminder(next.body, vars));
  }

  function send() {
    if (!url || !text.trim() || blockIfPlanExpired()) return;
    window.open(url, "_blank", "noopener,noreferrer");
    startTransition(async () => {
      try {
        await recordReminderSent({ subscriptionId: row.subscriptionId, clientId: row.clientId, message: text, category: row.category });
        setSentAt(new Date().toISOString());
        toast.success("Relance enregistrée");
      } catch (error) {
        toast.error("Relance non enregistrée", error instanceof Error ? error.message : undefined);
      }
    });
  }

  return (
    <article className="reminder-row">
      <div style={{ minWidth: 0 }}>
        <strong>{row.firstName} {row.lastName}</strong>
        <p>
          {row.service} · {dueLabel(row)}
          {sentAt && <> · <span style={{ color: "var(--sr-success)" }}>Relancé le {frDate(sentAt)}</span></>}
        </p>
        <label style={{ display: "block", marginTop: 10 }}>
          <span style={{ fontSize: 11, color: "var(--sr-fg-subtle)" }}>Message</span>
          <select value={template?.id ?? ""} onChange={(event) => chooseTemplate(event.target.value)} style={{ marginTop: 4 }}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id.startsWith("preset:") ? t.name : `★ ${t.name}`}
              </option>
            ))}
          </select>
        </label>
        <textarea
          data-no-i18n
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          maxLength={1000}
          style={{ marginTop: 8, width: "100%", resize: "vertical" }}
        />
      </div>
      <div className="reminder-actions" style={{ alignSelf: "end" }}>
        {url ? (
          <button type="button" className="primary" onClick={send} disabled={pending || !text.trim()}>
            <Icon name="send" size={14} /> {sentAt ? "Relancer à nouveau" : "Relancer"}
          </button>
        ) : (
          <span className="badge badge--danger">Téléphone manquant</span>
        )}
      </div>
    </article>
  );
}
