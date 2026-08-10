import { renewClientSubscription, cancelClientSubscription } from "@/app/actions/subscriptions";
import { GraceButton } from "@/components/GraceButton";
import { ActionForm } from "@/components/ui/ActionForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatDate, daysUntil } from "@/lib/dates";
import type { ClientSubscription } from "@/lib/types";

type Props = { subscriptions: ClientSubscription[]; emptyMessage?: string };

export function ClientTable({ subscriptions, emptyMessage = "Aucun client pour le moment." }: Props) {
  if (subscriptions.length === 0) {
    return <EmptyState title={emptyMessage} description="Ajoutez une vente pour voir apparaître vos abonnements ici." />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Service / Profil</th>
            <th>Début</th>
            <th>Fin</th>
            <th>Prix</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => {
            const daysLeft = daysUntil(sub.end_date);
            const isExpiredByDate = daysLeft < 0;
            const isUrgent = sub.status === "active" && !isExpiredByDate && daysLeft >= 0 && daysLeft <= 3;
            const effectiveStatus =
              isExpiredByDate && sub.status === "active" ? "expired" : sub.status;
            const serviceName = sub.slot?.account?.service_name ?? "—";
            const slotLabel = sub.slot?.label || `Profil ${sub.slot?.slot_number ?? ""}`;

            return (
              <tr key={sub.id} className={isUrgent ? "urgent-row" : ""}>
                <td>
                  <strong>{sub.client?.first_name} {sub.client?.last_name}</strong>
                  {sub.client?.phone && <span>{sub.client.phone}</span>}
                </td>
                <td>
                  <strong>{serviceName}</strong>
                  <span>{slotLabel}</span>
                </td>
                <td>{formatDate(sub.start_date)}</td>
                <td>
                  <strong>{formatDate(sub.end_date)}</strong>
                  <span>{daysLeft >= 0 ? `J-${daysLeft}` : "Expiré"}</span>
                </td>
                <td>{sub.price ? `${sub.price} FCFA` : "—"}</td>
                <td>
                  <span className={`status ${effectiveStatus}`}>
                    {effectiveStatus === "active" ? "Actif"
                      : effectiveStatus === "grace" ? "En grâce"
                      : "Expiré"}
                  </span>
                </td>
                <td>
                  <div className="actions">
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
                      <input type="hidden" name="status" value={sub.status} />
                      <SubmitButton>Renouveler</SubmitButton>
                    </ActionForm>
                    {sub.status === "active" && (
                      <ActionForm
                        action={cancelClientSubscription}
                        successMessage="Abonnement annulé"
                        errorMessage="Annulation impossible"
                        confirm={{
                          title: "Annuler cet abonnement ?",
                          description: "Le profil sera libéré. L’historique reste en compta.",
                          confirmLabel: "Annuler l’abonnement",
                          tone: "danger",
                        }}
                      >
                        <input type="hidden" name="id" value={sub.id} />
                        <SubmitButton className="secondary">Annuler</SubmitButton>
                      </ActionForm>
                    )}
                    <GraceButton
                      subId={sub.id}
                      currentStatus={sub.status}
                      graceUntil={sub.grace_until ?? null}
                      endDate={sub.end_date}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
