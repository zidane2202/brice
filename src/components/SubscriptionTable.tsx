import { formatDate, reminderLabel, daysUntil } from "@/lib/dates";
import type { Subscription } from "@/lib/types";
import { renewSubscription, updateSubscriptionStatus } from "@/app/actions";

type Props = {
  subscriptions: Subscription[];
  emptyLabel: string;
};

export function SubscriptionTable({ subscriptions, emptyLabel }: Props) {
  if (subscriptions.length === 0) {
    return <p className="empty">{emptyLabel}</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Client</th>
            <th>Debut</th>
            <th>Fin</th>
            <th>Etat</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((subscription) => {
            const isUrgent = daysUntil(subscription.end_date) <= 3;
            const clientName = subscription.client
              ? `${subscription.client.first_name} ${subscription.client.last_name}`
              : "Vous";

            return (
              <tr key={subscription.id} className={isUrgent ? "urgent-row" : ""}>
                <td>{subscription.service_name}</td>
                <td>
                  <strong>{clientName}</strong>
                  {subscription.client?.phone ? (
                    <span>{subscription.client.phone}</span>
                  ) : null}
                </td>
                <td>{formatDate(subscription.start_date)}</td>
                <td>
                  <strong>{formatDate(subscription.end_date)}</strong>
                  <span>{reminderLabel(subscription.end_date)}</span>
                </td>
                <td>
                  <span className={`status ${subscription.status}`}>
                    {subscription.status === "active" ? "Actif" : "Annule"}
                  </span>
                </td>
                <td>
                  <div className="actions">
                    <form action={renewSubscription}>
                      <input type="hidden" name="id" value={subscription.id} />
                      <input
                        type="hidden"
                        name="end_date"
                        value={subscription.end_date}
                      />
                      <button type="submit">Renouveler</button>
                    </form>
                    <form action={updateSubscriptionStatus}>
                      <input type="hidden" name="id" value={subscription.id} />
                      <input type="hidden" name="status" value="cancelled" />
                      <button type="submit" className="secondary">
                        Annuler
                      </button>
                    </form>
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
