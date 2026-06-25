"use client";

import { addProviderAccount } from "@/app/actions/accounts";
import { CATEGORIES, SERVICES } from "@/lib/services";
import { useState, useTransition } from "react";

export function AddAccountForm({ today }: { today: string }) {
  const [selectedService, setSelectedService] = useState("");
  const [slots, setSlots] = useState(1);
  const [officialMax, setOfficialMax] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleServiceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const name = e.target.value;
    setSelectedService(name);
    const svc = SERVICES.find((s) => s.name === name);
    if (svc) {
      setOfficialMax(svc.maxProfiles);
      setSlots(svc.maxProfiles);
    }
  }

  function handleSlotsChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = Number(e.target.value);
    if (officialMax !== null && val > officialMax) val = officialMax;
    if (val < 1) val = 1;
    setSlots(val);
  }

  async function handleSubmit(formData: FormData) {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await addProviderAccount(formData);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Erreur lors de la création");
      }
    });
  }

  return (
    <form action={handleSubmit} className="fields">
      <div className="fields two-cols">
        <label>
          Service
          <select
            name="service_name"
            value={selectedService}
            onChange={handleServiceChange}
            required
          >
            <option value="" disabled>Choisir une plateforme…</option>
            {CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {SERVICES.filter((s) => s.category === cat).map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label>
          Nombre de profils
          {selectedService && (
            <span className="service-slots-hint">
              max officiel : {SERVICES.find((s) => s.name === selectedService)?.maxProfiles}
            </span>
          )}
          <input
            name="max_slots"
            type="number"
            min="1"
            max={officialMax ?? 20}
            value={slots}
            onChange={handleSlotsChange}
            required
          />
        </label>
      </div>

      <div className="fields two-cols">
        <label>
          Date de début
          <input name="start_date" type="date" defaultValue={today} required />
        </label>
        <label>
          Durée (mois)
          <input name="duration_months" type="number" min="1" max="12" defaultValue="1" required />
        </label>
      </div>

      <div className="fields two-cols">
        <label>
          Surnom / Mode de paiement <span className="field-optional">(optionnel)</span>
          <input name="label" type="text" placeholder="Ex: Wave, Orange Money, Perso…" maxLength={40} />
        </label>
        <label>
          Coût payé (FCFA)
          <input name="cost" type="number" placeholder="Ex: 5000" />
        </label>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 6,
            background: "var(--sr-danger-bg)",
            border: "1px solid var(--sr-danger-border)",
            color: "var(--sr-danger)",
            font: "400 12px/1.4 var(--font-geist-sans)",
          }}
        >
          {errorMsg}
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        style={{
          opacity: isPending ? 0.7 : 1,
          cursor: isPending ? "not-allowed" : "pointer",
        }}
      >
        {isPending ? "Ajout…" : "Ajouter le compte"}
      </button>
    </form>
  );
}
