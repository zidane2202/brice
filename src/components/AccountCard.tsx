"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { renewProviderAccount, updateProviderAccountStatus } from "@/app/actions/accounts";
import { Icon } from "@/components/Icon";
import { ProviderGlyph } from "@/components/ProviderGlyph";
import { formatDate, daysUntil } from "@/lib/dates";
import type { ProviderAccount } from "@/lib/types";

type Props = { account: ProviderAccount & { used_slots: number }; displayName: string; balance?: number };

export function AccountCard({ account, displayName, balance = 0 }: Props) {
  const [renewOpen, setRenewOpen] = useState(false);
  const renewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!renewOpen) return;
    const onClick = (e: MouseEvent) => {
      if (renewRef.current && !renewRef.current.contains(e.target as Node)) {
        setRenewOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [renewOpen]);
  const daysLeft = daysUntil(account.end_date);
  const isExpired = daysLeft < 0 || account.status === "inactive";
  const isUrgent = !isExpired && daysLeft >= 0 && daysLeft <= 3;
  const used = account.used_slots;
  const total = account.max_slots;
  const pct = total > 0 ? (used / total) * 100 : 0;
  const isFull = used === total && used > 0;

  const statusMeta = isExpired
    ? { tone: "danger" as const, label: "Expiré",         dot: "var(--sr-danger)" }
    : isUrgent
    ? { tone: "warning" as const, label: "Expire bientôt", dot: "var(--sr-warning)" }
    : { tone: "success" as const, label: "Actif",          dot: "var(--sr-mint-500)" };

  const toneColorMap = {
    success: { bg: "var(--sr-success-bg)", border: "var(--sr-success-border)", color: "var(--sr-success)" },
    warning: { bg: "var(--sr-warning-bg)", border: "var(--sr-warning-border)", color: "var(--sr-warning)" },
    danger:  { bg: "var(--sr-danger-bg)",  border: "var(--sr-danger-border)",  color: "var(--sr-danger)" },
  };
  const tc = toneColorMap[statusMeta.tone];

  return (
    <div
      style={{
        position: "relative",
        background: "var(--sr-surface)",
        border: "1px solid var(--sr-border-subtle)",
        borderRadius: 8,
        padding: "16px 16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "background var(--sr-dur) var(--sr-ease), border-color var(--sr-dur) var(--sr-ease), transform var(--sr-dur) var(--sr-ease), box-shadow var(--sr-dur) var(--sr-ease)",
        boxShadow: "var(--sr-hairline-top)",
        opacity: isExpired ? 0.76 : 1,
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--sr-surface-2)";
        e.currentTarget.style.borderColor = "var(--sr-border-strong)";
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "var(--sr-shadow-pop)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--sr-surface)";
        e.currentTarget.style.borderColor = "var(--sr-border-subtle)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--sr-hairline-top)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <ProviderGlyph name={account.service_name} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: "600 15px/1.2 var(--font-geist-sans)",
              letterSpacing: "-0.01em",
              color: "var(--sr-fg-strong)",
            }}
          >
            {displayName}
          </div>
          {account.label && (
            <div
              style={{
                marginTop: 3,
                font: "400 12px/1 var(--font-geist-mono)",
                color: "var(--sr-fg-subtle)",
              }}
            >
              {account.label}
            </div>
          )}
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            height: 22,
            padding: "0 8px",
            background: tc.bg,
            border: `1px solid ${tc.border}`,
            borderRadius: 4,
            color: tc.color,
            font: "500 11px/1 var(--font-geist-sans)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: statusMeta.dot,
              boxShadow: statusMeta.tone === "success" ? `0 0 8px ${statusMeta.dot}` : "none",
              display: "inline-block",
            }}
          />
          {statusMeta.label}
        </span>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div
            style={{
              font: "600 28px/1 var(--font-geist-mono)",
              letterSpacing: "-0.025em",
              fontVariantNumeric: "tabular-nums",
              color: "var(--sr-fg-strong)",
            }}
          >
            {used}
            <span style={{ color: "var(--sr-fg-subtle)", fontWeight: 400 }}>/{total}</span>
          </div>
          <div style={{ font: "500 12px/1 var(--font-geist-sans)", color: "var(--sr-fg-muted)", marginBottom: 2 }}>
            profils {isFull ? "complet" : "vendus"}
          </div>
          <div style={{ flex: 1 }} />
          {isFull && statusMeta.tone === "success" && (
            <span
              style={{
                font: "500 10px/1 var(--font-geist-sans)",
                color: "var(--sr-mint-300)",
                padding: "3px 6px",
                border: "1px solid var(--sr-success-border)",
                background: "var(--sr-success-bg)",
                borderRadius: 4,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Plein
            </span>
          )}
        </div>
        <div
          style={{
            marginTop: 10,
            height: 4,
            background: "var(--sr-surface-3)",
            borderRadius: 999,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {Array.from({ length: total - 1 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${((i + 1) / total) * 100}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: "var(--sr-bg)",
                zIndex: 2,
              }}
            />
          ))}
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: isExpired
                ? "var(--sr-danger)"
                : isUrgent
                ? "var(--sr-warning)"
                : "var(--sr-mint-500)",
              borderRadius: 999,
              boxShadow: !isExpired && isFull ? "0 0 8px rgba(41,220,133,0.4)" : "none",
              transition: "width var(--sr-dur-slow) var(--sr-ease)",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "var(--sr-bg)",
          border: "1px solid var(--sr-border-subtle)",
          borderRadius: 6,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: "500 10px/1 var(--font-geist-sans)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--sr-fg-subtle)",
              marginBottom: 4,
            }}
          >
            Période
          </div>
          <div
            style={{
              font: "500 12px/1.2 var(--font-geist-mono)",
              color: "var(--sr-fg)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>{formatDate(account.start_date)}</span>
            <Icon name="arrowRight" size={11} style={{ color: "var(--sr-fg-disabled)" }} />
            <span
              style={{
                color: isUrgent ? "var(--sr-warning)" : isExpired ? "var(--sr-danger)" : "var(--sr-fg)",
                fontWeight: 600,
              }}
            >
              {formatDate(account.end_date)}
            </span>
          </div>
        </div>
        <div
          style={{
            font: "500 11px/1 var(--font-geist-mono)",
            color: isUrgent ? "var(--sr-warning)" : isExpired ? "var(--sr-danger)" : "var(--sr-fg-muted)",
            padding: "4px 7px",
            border: `1px solid ${isUrgent ? "var(--sr-warning-border)" : isExpired ? "var(--sr-danger-border)" : "var(--sr-border-subtle)"}`,
            background: isUrgent ? "var(--sr-warning-bg)" : isExpired ? "var(--sr-danger-bg)" : "var(--sr-surface-2)",
            borderRadius: 4,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {daysLeft > 0 ? `${daysLeft}j restants` : daysLeft === 0 ? "Expire aujourd'hui" : `il y a ${-daysLeft}j`}
        </div>
      </div>

      {account.cost ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingTop: 12,
            borderTop: "1px dashed var(--sr-border-subtle)",
          }}
        >
          <div>
            <div
              style={{
                font: "500 10px/1 var(--font-geist-sans)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--sr-fg-subtle)",
              }}
            >
              Coût payé
            </div>
            <div
              style={{
                marginTop: 4,
                font: "500 14px/1 var(--font-geist-mono)",
                color: "var(--sr-fg-strong)",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.015em",
              }}
            >
              {account.cost.toLocaleString("en-US").replace(/,/g, " ")}
              <span style={{ color: "var(--sr-fg-subtle)", marginLeft: 3, fontWeight: 400, letterSpacing: 0, fontSize: 11 }}>
                FCFA
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Link href={`/abonnements/${account.id}`} className="btn-link" style={{ minHeight: 30, height: 30, fontSize: "0.75rem" }}>
          Voir les profils <Icon name="arrowRight" size={11} />
        </Link>
        <div ref={renewRef} style={{ position: "relative" }}>
          <button
            type="button"
            className="secondary"
            onClick={() => setRenewOpen((v) => !v)}
            style={{ minHeight: 30, height: 30, fontSize: "0.75rem", paddingInline: 10 }}
          >
            <Icon name="refresh" size={11} /> +1 mois
            <Icon name="chevronD" size={11} style={{ marginLeft: 2, opacity: 0.6 }} />
          </button>
          {renewOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                left: 0,
                minWidth: 220,
                background: "var(--sr-surface-2)",
                border: "1px solid var(--sr-border-strong)",
                borderRadius: 8,
                boxShadow: "var(--sr-shadow-pop)",
                padding: 6,
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <div
                style={{
                  padding: "6px 8px 4px",
                  font: "500 10px/1.2 var(--font-geist-sans)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--sr-fg-subtle)",
                }}
              >
                Payer avec
              </div>
              {account.cost ? (
                <>
                  {(() => {
                    const insufficient = balance < (account.cost ?? 0);
                    return (
                      <form action={renewProviderAccount} style={{ margin: 0 }}>
                        <input type="hidden" name="id" value={account.id} />
                        <input type="hidden" name="end_date" value={account.end_date} />
                        <input type="hidden" name="duration_months" value="1" />
                        <input type="hidden" name="funded_by" value="balance" />
                        <button
                          type="submit"
                          disabled={insufficient}
                          title={insufficient ? "Solde insuffisant" : undefined}
                          style={{
                            width: "100%",
                            justifyContent: "flex-start",
                            background: "transparent",
                            border: "none",
                            padding: "8px 10px",
                            borderRadius: 5,
                            font: "500 12px/1.2 var(--font-geist-sans)",
                            color: insufficient ? "var(--sr-fg-disabled)" : "var(--sr-fg-strong)",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            textAlign: "left",
                            cursor: insufficient ? "not-allowed" : "pointer",
                            opacity: insufficient ? 0.55 : 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!insufficient) e.currentTarget.style.background = "var(--sr-surface-3)";
                          }}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <Icon
                            name="card"
                            size={13}
                            style={{ color: insufficient ? "var(--sr-fg-disabled)" : "var(--sr-mint-400)" }}
                          />
                          <div style={{ flex: 1 }}>
                            <div>Mon solde</div>
                            <div
                              style={{
                                font: "400 10px/1.2 var(--font-geist-mono)",
                                color: insufficient ? "var(--sr-danger)" : "var(--sr-fg-subtle)",
                              }}
                            >
                              {insufficient
                                ? `solde ${balance.toLocaleString("en-US").replace(/,/g, " ")} FCFA — insuffisant`
                                : `−${account.cost.toLocaleString("en-US").replace(/,/g, " ")} FCFA`}
                            </div>
                          </div>
                        </button>
                      </form>
                    );
                  })()}
                  <form action={renewProviderAccount} style={{ margin: 0 }}>
                    <input type="hidden" name="id" value={account.id} />
                    <input type="hidden" name="end_date" value={account.end_date} />
                    <input type="hidden" name="duration_months" value="1" />
                    <input type="hidden" name="funded_by" value="personal" />
                    <button
                      type="submit"
                      style={{
                        width: "100%",
                        justifyContent: "flex-start",
                        background: "transparent",
                        border: "none",
                        padding: "8px 10px",
                        borderRadius: 5,
                        font: "500 12px/1.2 var(--font-geist-sans)",
                        color: "var(--sr-fg-strong)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sr-surface-3)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <Icon name="zap" size={13} style={{ color: "var(--sr-fg-muted)" }} />
                      <div style={{ flex: 1 }}>
                        <div>Argent personnel</div>
                        <div style={{ font: "400 10px/1.2 var(--font-geist-mono)", color: "var(--sr-fg-subtle)" }}>
                          aucune déduction
                        </div>
                      </div>
                    </button>
                  </form>
                </>
              ) : (
                <form action={renewProviderAccount} style={{ margin: 0 }}>
                  <input type="hidden" name="id" value={account.id} />
                  <input type="hidden" name="end_date" value={account.end_date} />
                  <input type="hidden" name="duration_months" value="1" />
                  <input type="hidden" name="funded_by" value="personal" />
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      padding: "8px 10px",
                      borderRadius: 5,
                      font: "500 12px/1.2 var(--font-geist-sans)",
                      color: "var(--sr-fg-muted)",
                      cursor: "pointer",
                    }}
                  >
                    Pas de coût défini — renouveler
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
        <form action={updateProviderAccountStatus} style={{ margin: 0 }}>
          <input type="hidden" name="id" value={account.id} />
          <input type="hidden" name="status" value={account.status === "active" ? "inactive" : "active"} />
          <button type="submit" className="secondary" style={{ minHeight: 30, height: 30, fontSize: "0.75rem", paddingInline: 10 }}>
            {account.status === "active" ? "Désactiver" : "Réactiver"}
          </button>
        </form>
      </div>
    </div>
  );
}
