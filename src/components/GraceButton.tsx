"use client";

import { setGraceStatus, removeGraceStatus } from "@/app/actions/subscriptions";
import { useState } from "react";

type Props = {
  subId: string;
  currentStatus: "active" | "cancelled" | "grace";
  graceUntil: string | null;
  endDate: string;
};

function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export function GraceButton({ subId, currentStatus, graceUntil, endDate }: Props) {
  const [open, setOpen] = useState(false);
  const minDate = nextDay(endDate);

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
