"use client";

import { addManualExpense } from "@/app/actions/comptabilite";
import { EXPENSE_CATEGORIES } from "@/lib/comptabilite";
import type { ExpenseCategory } from "@/lib/types";
import { useState, useTransition } from "react";

export function AddExpenseForm({ today }: { today: string }) {
  const [category, setCategory] = useState<ExpenseCategory>("data");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await addManualExpense(formData);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
      }
    });
  }

  return (
    <form action={handleSubmit} className="fields">
      <div className="fields two-cols">
        <label>
          Montant (FCFA)
          <input name="amount" type="number" min="1" step="1" required placeholder="Ex: 5000" />
        </label>
        <label>
          Catégorie
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            required
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="fields two-cols">
        <label>
          Note / libellé
          <input
            name="label"
            type="text"
            placeholder={category === "other" ? "Obligatoire…" : "Optionnel"}
            required={category === "other"}
          />
        </label>
        <label>
          Date
          <input name="occurred_on" type="date" defaultValue={today} required />
        </label>
      </div>

      {category === "other" && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--sr-fg-subtle)" }}>
          Note obligatoire pour la catégorie Autre.
        </p>
      )}

      {errorMsg && (
        <p style={{ margin: 0, color: "var(--sr-danger)", fontSize: 13 }}>{errorMsg}</p>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? "Enregistrement…" : "Ajouter la dépense"}
      </button>
    </form>
  );
}
