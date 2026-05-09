import { renewProviderAccount, updateProviderAccountStatus } from "@/app/actions/accounts";
import { formatDate, daysUntil } from "@/lib/dates";
import type { ProviderAccount } from "@/lib/types";
import Link from "next/link";

type Props = { account: ProviderAccount & { used_slots: number } };

export function AccountCard({ account }: Props) {
  const daysLeft = daysUntil(account.end_date);
  const isUrgent = daysLeft >= 0 && daysLeft <= 3;
  const isExpired = daysLeft < 0;

  return (
    <div className={`account-card${isUrgent ? " account-card--urgent" : ""}${isExpired ? " account-card--expired" : ""}`}>
      <div className="account-card-header">
        <div>
          <p className="eyebrow">{account.service_name}</p>
          <strong className="account-slots-count">
            {account.used_slots}/{account.max_slots} profils
          </strong>
        </div>
        <span className={`status ${account.status}`}>
          {account.status === "active" ? "Actif" : "Inactif"}
        </span>
      </div>
      <div className="account-card-dates">
        <span>Du {formatDate(account.start_date)}</span>
        <span>au <strong>{formatDate(account.end_date)}</strong></span>
        {isUrgent && <span className="urgent-label">⚠ Expire dans {daysLeft}j</span>}
        {isExpired && <span className="expired-label">Expiré</span>}
      </div>
      {account.cost && <p className="account-cost">Coût : {account.cost} FCFA</p>}
      <div className="actions">
        <Link href={`/abonnements/${account.id}`} className="btn-link">
          Voir les profils →
        </Link>
        <form action={renewProviderAccount}>
          <input type="hidden" name="id" value={account.id} />
          <input type="hidden" name="end_date" value={account.end_date} />
          <input type="hidden" name="duration_months" value="1" />
          <button type="submit">Renouveler +1 mois</button>
        </form>
        <form action={updateProviderAccountStatus}>
          <input type="hidden" name="id" value={account.id} />
          <input type="hidden" name="status" value={account.status === "active" ? "inactive" : "active"} />
          <button type="submit" className="secondary">
            {account.status === "active" ? "Désactiver" : "Réactiver"}
          </button>
        </form>
      </div>
    </div>
  );
}
