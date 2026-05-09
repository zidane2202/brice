import { renewClientSubscription, cancelClientSubscription } from "@/app/actions/subscriptions";
import { formatDate, daysUntil } from "@/lib/dates";
import type { ClientSubscription } from "@/lib/types";

type Props = { subscriptions: ClientSubscription[] };

export function ClientTable({ subscriptions }: Props) {
  if (subscriptions.length === 0) {
    return <p className="empty">Aucun client actif pour le moment.</p>;
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
            const isUrgent = daysLeft >= 0 && daysLeft <= 3;
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
                  <span className={`status ${sub.status}`}>
                    {sub.status === "active" ? "Actif" : "Annulé"}
                  </span>
                </td>
                <td>
                  <div className="actions">
                    <form action={renewClientSubscription}>
                      <input type="hidden" name="id" value={sub.id} />
                      <input type="hidden" name="end_date" value={sub.end_date} />
                      <input type="hidden" name="duration_months" value="1" />
                      <button type="submit">Renouveler</button>
                    </form>
                    {sub.status === "active" && (
                      <form action={cancelClientSubscription}>
                        <input type="hidden" name="id" value={sub.id} />
                        <button type="submit" className="secondary">Annuler</button>
                      </form>
                    )}
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
