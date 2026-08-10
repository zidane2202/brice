"use client";

import { setGraceStatus, removeGraceStatus } from "@/app/actions/subscriptions";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { addDays } from "@/lib/dates";
import { useState } from "react";

type Props = {
  subId: string;
  currentStatus: "active" | "cancelled" | "grace";
  graceUntil: string | null;
  endDate: string;
};

export function GraceButton({ subId, currentStatus, graceUntil, endDate }: Props) {
  const [open, setOpen] = useState(false);
  const minDate = addDays(endDate, 1);

  if (currentStatus === "grace") {
    return (
      <div className="grace-active">
        {graceUntil && <span className="grace-until-label">Jusqu&apos;au {graceUntil}</span>}
        <ActionForm
          action={removeGraceStatus}
          successMessage="Grâce levée"
          errorMessage="Impossible de lever la grâce"
          confirm={{
            title: "Lever la période de grâce ?",
            confirmLabel: "Lever la grâce",
            tone: "danger",
          }}
        >
          <input type="hidden" name="id" value={subId} />
          <SubmitButton className="secondary grace-remove-btn">Lever la grâce</SubmitButton>
        </ActionForm>
      </div>
    );
  }

  if (currentStatus !== "active") return null;

  if (!open) {
    return (
      <button type="button" className="secondary grace-trigger-btn" onClick={() => setOpen(true)}>
        En grâce
      </button>
    );
  }

  return (
    <ActionForm
      action={setGraceStatus}
      successMessage="Période de grâce enregistrée"
      errorMessage="Impossible d’activer la grâce"
      confirm={{
        title: "Confirmer la période de grâce ?",
        description: "Le client reste actif jusqu’à la date choisie.",
        confirmLabel: "Confirmer",
      }}
      className="grace-form"
    >
      <input type="hidden" name="id" value={subId} />
      <input
        name="grace_until"
        type="date"
        required
        min={minDate}
        defaultValue={minDate}
        className="grace-date-input"
      />
      <SubmitButton className="grace-confirm-btn">Confirmer</SubmitButton>
      <button type="button" className="secondary" onClick={() => setOpen(false)}>✕</button>
    </ActionForm>
  );
}
