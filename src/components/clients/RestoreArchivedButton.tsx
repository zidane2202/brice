"use client";

import { restoreArchivedClient } from "@/app/actions/clients";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function RestoreArchivedButton({ clientId }: { clientId: string }) {
  return (
    <ActionForm
      action={async (_formData: FormData) => {
        await restoreArchivedClient(clientId);
      }}
      successMessage="Client restauré"
      errorMessage="Restauration impossible"
      confirm={{
        title: "Restaurer ce client ?",
        description: "Il réapparaîtra dans votre liste clients active.",
        confirmLabel: "Restaurer",
      }}
    >
      <SubmitButton className="secondary">Restaurer</SubmitButton>
    </ActionForm>
  );
}
