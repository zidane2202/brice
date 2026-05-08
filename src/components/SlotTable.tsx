import type { AccountSlot } from "@/lib/types";
import { formatDate, daysUntil } from "@/lib/dates";

type Props = { slots: AccountSlot[] };

export function SlotTable({ slots }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Slot</th>
            <th>Client</th>
            <th>Début</th>
            <th>Fin</th>
            <th>Prix</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const sub = slot.active_subscription;
            const daysLeft = sub ? daysUntil(sub.end_date) : null;
            const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
            return (
              <tr key={slot.id} className={isUrgent ? "urgent-row" : ""}>
                <td><strong>{slot.label || `Profil ${slot.slot_number}`}</strong></td>
                <td>
                  {sub?.client
                    ? <><strong>{sub.client.first_name} {sub.client.last_name}</strong><span>{sub.client.phone}</span></>
                    : <span className="slot-free">Libre</span>
                  }
                </td>
                <td>{sub ? formatDate(sub.start_date) : "—"}</td>
                <td>
                  {sub
                    ? <><strong>{formatDate(sub.end_date)}</strong><span>{daysLeft !== null && daysLeft >= 0 ? `J-${daysLeft}` : daysLeft !== null ? "Expiré" : ""}</span></>
                    : "—"
                  }
                </td>
                <td>{sub?.price ? `${sub.price} FCFA` : "—"}</td>
                <td>
                  {sub
                    ? <span className={`status ${sub.status}`}>{sub.status === "active" ? "Actif" : "Annulé"}</span>
                    : <span className="status slot-free-badge">Libre</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
