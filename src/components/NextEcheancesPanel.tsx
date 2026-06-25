import { renewProviderAccount } from "@/app/actions/accounts";
import { renewClientSubscription } from "@/app/actions/subscriptions";
import { Icon } from "@/components/Icon";
import { ProviderGlyph } from "@/components/ProviderGlyph";
import { formatDate, daysUntil } from "@/lib/dates";
import type { ClientSubscription, ProviderAccount } from "@/lib/types";

type Props = {
  subscriptions: ClientSubscription[];
  accounts?: ProviderAccount[];
};

type UrgencyItem =
  | { kind: "sub"; daysLeft: number; sub: ClientSubscription }
  | { kind: "account"; daysLeft: number; account: ProviderAccount };

export function NextEcheancesPanel({ subscriptions, accounts = [] }: Props) {
  const items: UrgencyItem[] = [
    ...subscriptions.map<UrgencyItem>((sub) => ({
      kind: "sub",
      daysLeft: daysUntil(sub.end_date),
      sub,
    })),
    ...accounts.map<UrgencyItem>((account) => ({
      kind: "account",
      daysLeft: daysUntil(account.end_date),
      account,
    })),
  ].sort((a, b) => a.daysLeft - b.daysLeft);

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: "32px 16px",
          textAlign: "center",
          color: "var(--sr-fg-muted)",
          font: "400 13px/1.4 var(--font-geist-sans)",
        }}
      >
        Aucune relance dans les 3 prochains jours.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((item, i) =>
        item.kind === "sub" ? (
          <SubRow key={`s-${item.sub.id}`} sub={item.sub} daysLeft={item.daysLeft} isLast={i === items.length - 1} />
        ) : (
          <AccountRow
            key={`a-${item.account.id}`}
            account={item.account}
            daysLeft={item.daysLeft}
            isLast={i === items.length - 1}
          />
        )
      )}
    </div>
  );
}

function toneColors(daysLeft: number) {
  const tone = daysLeft <= 0 ? "danger" : "warning";
  return {
    color: tone === "danger" ? "var(--sr-danger)" : "var(--sr-warning)",
    bg: tone === "danger" ? "var(--sr-danger-bg)" : "var(--sr-warning-bg)",
    border: tone === "danger" ? "var(--sr-danger-border)" : "var(--sr-warning-border)",
  };
}

function DaysBadge({ daysLeft }: { daysLeft: number }) {
  const { color, bg, border } = toneColors(daysLeft);
  return (
    <span
      style={{
        font: "500 11px/1 var(--font-geist-mono)",
        color,
        padding: "3px 7px",
        border: `1px solid ${border}`,
        background: bg,
        borderRadius: 3,
        fontVariantNumeric: "tabular-nums",
        display: "inline-block",
      }}
    >
      {daysLeft > 0 ? `J-${daysLeft}` : daysLeft === 0 ? "Aujourd'hui" : "Expiré"}
    </span>
  );
}

function SubRow({ sub, daysLeft, isLast }: { sub: ClientSubscription; daysLeft: number; isLast: boolean }) {
  const serviceName = sub.slot?.account?.service_name ?? "—";
  const slotLabel = sub.slot?.label || `Profil ${sub.slot?.slot_number ?? ""}`;
  const fullName = `${sub.client?.first_name ?? ""} ${sub.client?.last_name ?? ""}`.trim() || "—";

  return (
    <div
      style={{
        padding: "12px 4px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: isLast ? "none" : "1px solid var(--sr-border-subtle)",
      }}
    >
      <ProviderGlyph name={serviceName} size={28} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "500 13px/1.2 var(--font-geist-sans)",
            color: "var(--sr-fg-strong)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {fullName}
        </div>
        <div
          style={{
            marginTop: 3,
            font: "400 11px/1.3 var(--font-geist-mono)",
            color: "var(--sr-fg-subtle)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {serviceName} · {slotLabel} · échoit {formatDate(sub.end_date)}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <DaysBadge daysLeft={daysLeft} />
        {sub.price ? (
          <div
            style={{
              marginTop: 5,
              font: "500 11px/1 var(--font-geist-mono)",
              color: "var(--sr-fg-muted)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {sub.price.toLocaleString("en-US").replace(/,/g, " ")} FCFA
          </div>
        ) : null}
      </div>

      <form action={renewClientSubscription} style={{ margin: 0 }}>
        <input type="hidden" name="id" value={sub.id} />
        <input type="hidden" name="end_date" value={sub.end_date} />
        <input type="hidden" name="duration_months" value="1" />
        <input type="hidden" name="status" value={sub.status} />
        <button
          type="submit"
          style={{
            minHeight: 28,
            height: 28,
            padding: "0 10px",
            fontSize: "0.72rem",
          }}
        >
          Renouveler
        </button>
      </form>
    </div>
  );
}

function AccountRow({
  account,
  daysLeft,
  isLast,
}: {
  account: ProviderAccount;
  daysLeft: number;
  isLast: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 4px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: isLast ? "none" : "1px solid var(--sr-border-subtle)",
      }}
    >
      <ProviderGlyph name={account.service_name} size={28} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "500 13px/1.2 var(--font-geist-sans)",
            color: "var(--sr-fg-strong)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {account.service_name}
          <span
            style={{
              font: "500 9px/1 var(--font-geist-sans)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--sr-mint-300)",
              padding: "2px 5px",
              border: "1px solid var(--sr-success-border)",
              background: "var(--sr-success-bg)",
              borderRadius: 3,
            }}
          >
            Compte
          </span>
        </div>
        <div
          style={{
            marginTop: 3,
            font: "400 11px/1.3 var(--font-geist-mono)",
            color: "var(--sr-fg-subtle)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {account.label ? `${account.label} · ` : ""}échoit {formatDate(account.end_date)}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <DaysBadge daysLeft={daysLeft} />
        {account.cost ? (
          <div
            style={{
              marginTop: 5,
              font: "500 11px/1 var(--font-geist-mono)",
              color: "var(--sr-fg-muted)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {account.cost.toLocaleString("en-US").replace(/,/g, " ")} FCFA
          </div>
        ) : null}
      </div>

      <form action={renewProviderAccount} style={{ margin: 0 }}>
        <input type="hidden" name="id" value={account.id} />
        <input type="hidden" name="end_date" value={account.end_date} />
        <input type="hidden" name="duration_months" value="1" />
        <input type="hidden" name="funded_by" value="personal" />
        <button
          type="submit"
          className="secondary"
          title="Renouveler avec argent personnel (pour utiliser le solde, va sur Mes abonnements)"
          style={{
            minHeight: 28,
            height: 28,
            padding: "0 10px",
            fontSize: "0.72rem",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Icon name="refresh" size={11} />
          +1 mois
        </button>
      </form>
    </div>
  );
}
