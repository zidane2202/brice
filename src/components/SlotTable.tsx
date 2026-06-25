import type { AccountSlot } from "@/lib/types";
import { formatDate, daysUntil } from "@/lib/dates";

type Props = { slots: AccountSlot[] };

export function SlotTable({ slots }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Profil</th>
            <th>Client</th>
            <th>PIN</th>
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
            const isExpired = daysLeft !== null && daysLeft < 0;
            const isUrgent = !isExpired && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
            const effectiveStatus =
              sub && isExpired && sub.status === "active" ? "expired" : sub?.status;
            return (
              <tr key={slot.id} className={isUrgent ? "urgent-row" : ""}>
                <td><strong>{slot.label || `Profil ${slot.slot_number}`}</strong></td>
                <td>
                  {sub?.client
                    ? <><strong>{sub.client.first_name} {sub.client.last_name}</strong><span>{sub.client.phone}</span></>
                    : <span className="slot-free">Libre</span>
                  }
                </td>
                <td>
                  {sub?.client?.pin_code
                    ? <strong style={{ fontFamily: "var(--font-geist-mono)", letterSpacing: "0.1em" }}>{sub.client.pin_code}</strong>
                    : <span style={{ color: "var(--muted)" }}>—</span>
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
                    ? <span className={`status ${effectiveStatus}`}>
                        {effectiveStatus === "active" ? "• Actif"
                          : effectiveStatus === "grace" ? "• En grâce"
                          : "• Expiré"}
                      </span>
                    : <span className="status slot-free-badge">• Libre</span>
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
