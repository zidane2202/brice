"use client";

import { useActionState } from "react";

type Profile = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  city?: string | null;
};

type Props = {
  profile: Profile | null;
  email: string;
  action: (prev: { error?: string; success?: boolean } | undefined, formData: FormData) => Promise<{ error?: string; success?: boolean }>;
};

export function ProfileForm({ profile, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="fields">
      {state?.error && (
        <p style={{ color: "var(--danger)", background: "var(--danger-soft)", borderRadius: 8, padding: "10px 14px", fontSize: "0.875rem" }}>
          {state.error}
        </p>
      )}
      {state?.success && (
        <p style={{ color: "var(--success-text)", background: "var(--success-soft)", borderRadius: 8, padding: "10px 14px", fontSize: "0.875rem" }}>
          Profil mis à jour avec succès.
        </p>
      )}
      <div className="fields two-cols">
        <label>
          Prénom
          <input name="first_name" defaultValue={profile?.first_name ?? ""} placeholder="Brice" />
        </label>
        <label>
          Nom
          <input name="last_name" defaultValue={profile?.last_name ?? ""} placeholder="Mbarga" />
        </label>
      </div>
      <label>
        Téléphone
        <input name="phone" type="tel" defaultValue={profile?.phone ?? ""} placeholder="+237 6 00 00 00 00" />
      </label>
      <label>
        Ville
        <input name="city" defaultValue={profile?.city ?? ""} placeholder="Yaoundé" />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
