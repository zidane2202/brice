"use client";

import { setGraceStatus, removeGraceStatus } from "@/app/actions/subscriptions";
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
        {graceUntil && <span className="grace-until-label">Jusqu'au {graceUntil}</span>}
        <form action={removeGraceStatus}>
          <input type="hidden" name="id" value={subId} />
          <button type="submit" className="secondary grace-remove-btn">Lever la grâce</button>
        </form>
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
    <form action={setGraceStatus} className="grace-form" onSubmit={() => setOpen(false)}>
      <input type="hidden" name="id" value={subId} />
      <input
        name="grace_until"
        type="date"
        required
        min={minDate}
        defaultValue={minDate}
        className="grace-date-input"
      />
      <button type="submit" className="grace-confirm-btn">Confirmer</button>
      <button type="button" className="secondary" onClick={() => setOpen(false)}>✕</button>
    </form>
  );
}
