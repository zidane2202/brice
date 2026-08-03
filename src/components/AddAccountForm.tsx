"use client";

import { addProviderAccount } from "@/app/actions/accounts";
import { CATEGORIES, SERVICES } from "@/lib/services";
import { PasswordInput } from "@/components/PasswordInput";
import { PlanLimitModal } from "@/components/PlanLimitModal";
import { PLAN_LIMIT_ACCOUNT, parsePlanLimitError } from "@/lib/plans";
import type { PlanId } from "@/lib/plans";
import { useState, useTransition } from "react";

type Props = {
  today: string;
  plan: PlanId;
  slotCap: number;
};

export function AddAccountForm({ today, plan, slotCap }: Props) {
  const [selectedService, setSelectedService] = useState("");
  const [slots, setSlots] = useState(1);
  const [officialMax, setOfficialMax] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitMode, setLimitMode] = useState<"free-upgrade" | "pro-extras">("free-upgrade");
  const [limitMessage, setLimitMessage] = useState<string | undefined>();

  function handleServiceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const name = e.target.value;
    setSelectedService(name);
    const svc = SERVICES.find((s) => s.name === name);
    if (svc) {
      setOfficialMax(svc.maxProfiles);
      setSlots(Math.min(svc.maxProfiles, slotCap));
    }
  }

  function handleSlotsChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = Number(e.target.value);
    const hardMax = Math.min(officialMax ?? slotCap, slotCap);
    if (val > hardMax) val = hardMax;
    if (val < 1) val = 1;
    setSlots(val);
  }

  async function handleSubmit(formData: FormData) {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await addProviderAccount(formData);
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Erreur lors de la création";
        const parsed = parsePlanLimitError(raw);
        if (parsed) {
          setLimitMessage(parsed.message);
          if (plan === "pro" && parsed.code === PLAN_LIMIT_ACCOUNT) {
            setLimitMode("pro-extras");
          } else if (plan === "free") {
            setLimitMode("free-upgrade");
          } else if (plan === "pro") {
            setLimitMode("pro-extras");
          } else {
            setErrorMsg(parsed.message);
            return;
          }
          setLimitOpen(true);
          setErrorMsg(parsed.message);
          return;
        }
        setErrorMsg(raw);
      }
    });
  }

  const hardMax = Math.min(officialMax ?? slotCap, slotCap);

  return (
    <>
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
              max plan : {slotCap}
              {officialMax != null ? ` · max officiel : ${officialMax}` : ""}
            </span>
          )}
          <input
            name="max_slots"
            type="number"
            min="1"
            max={hardMax}
            value={slots}
            onChange={handleSlotsChange}
            required
          />
        </label>
      </div>

      <div className="fields two-cols">
        <label>
          E-mail du compte
          <input
            name="account_email"
            type="email"
            placeholder="Ex: compte@gmail.com"
            autoComplete="off"
          />
        </label>
        <label>
          Mot de passe du compte
          <PasswordInput name="account_password" placeholder="Mot de passe" />
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
    <PlanLimitModal
      open={limitOpen}
      onClose={() => setLimitOpen(false)}
      mode={limitMode}
      message={limitMessage}
    />
    </>
  );
}
