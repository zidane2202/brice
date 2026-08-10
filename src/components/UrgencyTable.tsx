import { renewClientSubscription } from "@/app/actions/subscriptions";
import { ActionForm } from "@/components/ui/ActionForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatDate, daysUntil } from "@/lib/dates";
import type { ClientSubscription } from "@/lib/types";

type Props = { subscriptions: ClientSubscription[] };

export function UrgencyTable({ subscriptions }: Props) {
  if (subscriptions.length === 0) {
    return (
      <EmptyState
        title="Aucune relance urgente"
        description="Aucun abonnement n’expire dans les 3 prochains jours."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Service / Profil</th>
            <th>Téléphone</th>
            <th>Fin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => {
            const daysLeft = daysUntil(sub.end_date);
            const serviceName = sub.slot?.account?.service_name ?? "—";
            const slotLabel = sub.slot?.label || `Profil ${sub.slot?.slot_number ?? ""}`;

            return (
              <tr key={sub.id} className="urgent-row">
                <td><strong>{sub.client?.first_name} {sub.client?.last_name}</strong></td>
                <td><strong>{serviceName}</strong><span>{slotLabel}</span></td>
                <td>{sub.client?.phone ?? "—"}</td>
                <td>
                  <strong>{formatDate(sub.end_date)}</strong>
                  <span>{daysLeft >= 0 ? `J-${daysLeft}` : "Expiré"}</span>
                </td>
                <td>
                  <ActionForm
                    action={renewClientSubscription}
                    successMessage="Abonnement renouvelé"
                    errorMessage="Renouvellement impossible"
                    confirm={{
                      title: "Renouveler cet abonnement ?",
                      description: "Une transaction et une facture seront créées.",
                      confirmLabel: "Renouveler",
                    }}
                  >
                    <input type="hidden" name="id" value={sub.id} />
                    <input type="hidden" name="end_date" value={sub.end_date} />
                    <input type="hidden" name="duration_months" value="1" />
                    <SubmitButton>Renouveler</SubmitButton>
                  </ActionForm>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
