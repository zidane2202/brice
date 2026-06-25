import { ProviderGlyph } from "@/components/ProviderGlyph";
import type { ClientSubscription } from "@/lib/types";

type ProviderColors = Record<string, string>;

const PROVIDER_BG: ProviderColors = {
  "Netflix": "#E50914",
  "Spotify": "#1DB954",
  "Disney+": "#0E2A6B",
  "HBO Max": "#5B27D6",
  "Max": "#5B27D6",
  "Prime Video": "#00A8E1",
  "Amazon Prime": "#00A8E1",
  "YouTube": "#FF0000",
  "YouTube Premium": "#FF0000",
  "ChatGPT": "#10A37F",
  "Claude": "#D97757",
  "Apple TV": "#1D1D1F",
  "Apple TV+": "#1D1D1F",
  "Apple Music": "#FC3C44",
  "Crunchyroll": "#F47521",
  "Deezer": "#A238FF",
  "Canva": "#00C4CC",
  "Figma": "#F24E1E",
  "Notion": "#FFFFFF",
  "NordVPN": "#4687FF",
  "ExpressVPN": "#DA3940",
};

type Props = { subscriptions: ClientSubscription[] };

export function TopProvidersPanel({ subscriptions }: Props) {
  const map = new Map<string, { provider: string; profils: number; revenue: number; accounts: Set<string> }>();
  for (const sub of subscriptions) {
    const name = sub.slot?.account?.service_name;
    if (!name) continue;
    const entry = map.get(name) ?? { provider: name, profils: 0, revenue: 0, accounts: new Set<string>() };
    entry.profils += 1;
    entry.revenue += sub.price ?? 0;
    if (sub.slot?.account?.id) entry.accounts.add(sub.slot.account.id);
    map.set(name, entry);
  }

  const list = Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  if (list.length === 0) {
    return (
      <div
        style={{
          padding: "32px 16px",
          textAlign: "center",
          color: "var(--sr-fg-muted)",
          font: "400 13px/1.4 var(--font-geist-sans)",
        }}
      >
        Aucun abonnement vendu pour le moment.
      </div>
    );
  }

  const maxRev = Math.max(...list.map((x) => x.revenue), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {list.map((p) => {
        const pct = (p.revenue / maxRev) * 100;
        const brandBg = PROVIDER_BG[p.provider] ?? "#888";
        return (
          <div key={p.provider} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ProviderGlyph name={p.provider} size={22} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  marginBottom: 5,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    font: "500 13px/1 var(--font-geist-sans)",
                    color: "var(--sr-fg)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.provider}
                </div>
                <div
                  style={{
                    font: "400 11px/1 var(--font-geist-mono)",
                    color: "var(--sr-fg-subtle)",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.profils} profil{p.profils > 1 ? "s" : ""} · {p.accounts.size} compte{p.accounts.size > 1 ? "s" : ""}
                </div>
                <div
                  style={{
                    font: "500 12px/1 var(--font-geist-mono)",
                    color: "var(--sr-fg-strong)",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.01em",
                    minWidth: 90,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.revenue.toLocaleString("en-US").replace(/,/g, " ")}
                  <span style={{ color: "var(--sr-fg-subtle)", marginLeft: 3, fontWeight: 400 }}>FCFA</span>
                </div>
              </div>
              <div
                style={{
                  height: 4,
                  background: "var(--sr-surface-3)",
                  borderRadius: 999,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${brandBg}, ${brandBg}88)`,
                    borderRadius: 999,
                    transition: "width var(--sr-dur-slow) var(--sr-ease)",
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
