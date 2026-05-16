"use client";

import { updateProviderAccountLabel } from "@/app/actions/accounts";
import { useState } from "react";

export function EditableLabel({ id, label }: { id: string; label: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label ?? "");

  async function handleSubmit(formData: FormData) {
    await updateProviderAccountLabel(formData);
    setEditing(false);
  }

  if (editing) {
    return (
      <form action={handleSubmit} className="label-edit-form">
        <input type="hidden" name="id" value={id} />
        <input
          name="label"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex: Compte Famille"
          maxLength={40}
          autoFocus
        />
        <button type="submit" className="label-btn label-btn--confirm" title="Confirmer">✓</button>
        <button type="button" className="label-btn label-btn--cancel" onClick={() => { setValue(label ?? ""); setEditing(false); }} title="Annuler">✕</button>
      </form>
    );
  }

  return (
    <button type="button" className="label-display" onClick={() => setEditing(true)} title="Renommer ce compte">
      {label
        ? <span className="account-label">{label}</span>
        : <span className="account-label-empty">+ Surnom</span>}
    </button>
  );
}
