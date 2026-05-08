import { renewClientSubscription } from "@/app/actions/subscriptions";
import { formatDate, daysUntil } from "@/lib/dates";
import type { ClientSubscription } from "@/lib/types";

type Props = { subscriptions: ClientSubscription[] };

export function UrgencyTable({ subscriptions }: Props) {
  if (subscriptions.length === 0) {
    return <p className="empty">Aucun abonnement à relancer dans les 3 prochains jours.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Service / Slot</th>
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
                  <form action={renewClientSubscription}>
                    <input type="hidden" name="id" value={sub.id} />
                    <input type="hidden" name="end_date" value={sub.end_date} />
                    <input type="hidden" name="duration_months" value="1" />
                    <button type="submit">Renouveler</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
