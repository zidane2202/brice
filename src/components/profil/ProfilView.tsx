"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { updateProfile } from "@/app/actions/profile";
import { useActionState } from "react";

type Section = { id: string; label: string; icon: string; danger?: boolean };

const SECTIONS: Section[] = [
  { id: "perso",  label: "Informations personnelles", icon: "users" },
  { id: "biz",    label: "Mon activité",              icon: "dashboard" },
  { id: "secu",   label: "Sécurité",                  icon: "settings" },
  { id: "plan",   label: "Mon plan",                  icon: "zap" },
  { id: "danger", label: "Zone de danger",            icon: "alert", danger: true },
];

type ProfileData = {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  city?: string | null;
  role?: string | null;
  plan?: string | null;
};

type Props = {
  profile: ProfileData | null;
  email: string;
  createdAt: string;
  stats: {
    clientsCount: number;
    activeAccounts: number;
    lifetimeRevenue: number;
    paymentRate: number;
  };
};

export function ProfilView({ profile, email, createdAt, stats }: Props) {
  const [active, setActive] = useState("perso");

  const scrollTo = (id: string) => {
    setActive(id);
    const el = document.getElementById(`section-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActive(visible[0].target.id.replace("section-", ""));
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.5, 1] }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(`section-${s.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const fullName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || email.split("@")[0];
  const initials = fullName.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const isPro = (profile?.plan ?? "free") !== "free";

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, marginInline: -32, marginTop: -32, marginBottom: -32 }}>
      <aside
        className="sr-scroll"
        style={{
          width: 240,
          flex: "0 0 240px",
          padding: "32px 12px 16px",
          borderRight: "1px solid var(--sr-border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          overflow: "auto",
        }}
      >
        <div
          style={{
            font: "500 10px/1 var(--font-geist-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--sr-fg-subtle)",
            padding: "0 12px 8px",
          }}
        >
          Paramètres
        </div>
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className="secondary"
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                height: 32,
                minHeight: 32,
                padding: "0 12px",
                background: isActive ? "var(--sr-surface-2)" : "transparent",
                border: "1px solid " + (isActive ? "var(--sr-border)" : "transparent"),
                color: s.danger
                  ? isActive
                    ? "var(--sr-danger)"
                    : "var(--sr-fg-subtle)"
                  : isActive
                  ? "var(--sr-fg)"
                  : "var(--sr-fg-muted)",
                font: "500 13px/1 var(--font-geist-sans)",
                textAlign: "left",
                justifyContent: "flex-start",
                boxShadow: "none",
                transition: "all var(--sr-dur-fast) var(--sr-ease)",
              }}
            >
              {isActive && !s.danger && (
                <span
                  style={{
                    position: "absolute",
                    left: -12,
                    top: 6,
                    bottom: 6,
                    width: 2,
                    borderRadius: 2,
                    background: "var(--sr-mint-500)",
                    boxShadow: "0 0 12px rgba(41,220,133,0.6)",
                  }}
                />
              )}
              <Icon name={s.icon} size={14} />
              <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
            </button>
          );
        })}
      </aside>

      <div className="sr-scroll" style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        <div
          style={{
            padding: "32px 40px 32px",
            borderBottom: "1px solid var(--sr-border-subtle)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -100,
              right: -80,
              width: 360,
              height: 360,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(41,220,133,0.10), transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <p className="dash-eyebrow" style={{ marginBottom: 14 }}>Mon compte</p>

          <div style={{ display: "flex", alignItems: "center", gap: 22, position: "relative" }}>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 18,
                  background: "linear-gradient(135deg, #29DC85, #169A5C)",
                  color: "#001A0C",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: "600 32px/1 var(--font-geist-sans)",
                  letterSpacing: "-0.015em",
                  boxShadow:
                    "0 0 0 1px rgba(255,255,255,0.10), 0 12px 32px -8px rgba(41,220,133,0.45), inset 0 1px 0 rgba(255,255,255,0.25)",
                }}
              >
                {initials}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1
                  style={{
                    margin: 0,
                    font: "600 32px/1.1 var(--font-geist-sans)",
                    letterSpacing: "-0.022em",
                    color: "var(--sr-fg-strong)",
                  }}
                >
                  {fullName}
                </h1>
                {isPro && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "0 8px",
                      height: 22,
                      background:
                        "linear-gradient(135deg, rgba(41,220,133,0.16), rgba(92,200,255,0.10), rgba(179,136,255,0.12))",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 4,
                      font: "600 10px/1 var(--font-geist-sans)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--sr-fg-strong)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                    }}
                  >
                    <Icon name="zap" size={10} /> Pro
                  </span>
                )}
              </div>
              <div
                style={{
                  marginTop: 8,
                  font: "400 14px/1.4 var(--font-geist-sans)",
                  color: "var(--sr-fg-muted)",
                }}
              >
                {profile?.role === "admin" ? "Administrateur" : "Opérateur"}{" "}
                {profile?.city && (
                  <>
                    · <span style={{ color: "var(--sr-fg)" }}>{profile.city}</span>
                  </>
                )}{" "}
                · membre depuis{" "}
                <span style={{ color: "var(--sr-fg)" }}>
                  {new Date(createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                </span>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 24, flexWrap: "wrap" }}>
                <MiniInline label="Clients" value={String(stats.clientsCount)} />
                <MiniInline label="Comptes actifs" value={String(stats.activeAccounts)} />
                <MiniInline
                  label="Revenu lifetime"
                  value={formatShort(stats.lifetimeRevenue)}
                  suffix="FCFA"
                />
                <MiniInline label="Taux paiement" value={String(stats.paymentRate)} suffix="%" />
              </div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 820, padding: "16px 40px 80px", display: "flex", flexDirection: "column", gap: 32 }}>
          <PersoSection profile={profile} email={email} />
          <BizSection city={profile?.city ?? ""} />
          <SecuSection />
          <PlanSection plan={profile?.plan ?? "free"} />
          <DangerSection />
        </div>
      </div>
    </div>
  );
}

function MiniInline({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <div
        style={{
          font: "500 10px/1 var(--font-geist-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--sr-fg-subtle)",
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 5, display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{
            font: "600 18px/1 var(--font-geist-mono)",
            letterSpacing: "-0.025em",
            fontVariantNumeric: "tabular-nums",
            color: "var(--sr-fg-strong)",
          }}
        >
          {value}
        </span>
        {suffix && <span style={{ font: "400 10px/1 var(--font-geist-mono)", color: "var(--sr-fg-subtle)" }}>{suffix}</span>}
      </div>
    </div>
  );
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "k";
  return String(n);
}

function PrSection({
  id,
  title,
  subtitle,
  danger,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={`section-${id}`} style={{ scrollMarginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              font: "600 18px/1.2 var(--font-geist-sans)",
              letterSpacing: "-0.012em",
              color: danger ? "var(--sr-danger)" : "var(--sr-fg-strong)",
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <div style={{ marginTop: 4, font: "400 13px/1.4 var(--font-geist-sans)", color: "var(--sr-fg-muted)" }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          background: "var(--sr-surface)",
          border: "1px solid " + (danger ? "var(--sr-danger-border)" : "var(--sr-border-subtle)"),
          borderRadius: 10,
          boxShadow: "var(--sr-hairline-top)",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function FormRow({
  label,
  hint,
  children,
  divider = true,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "200px 1fr",
        gap: 24,
        padding: "16px 20px",
        borderBottom: divider ? "1px solid var(--sr-border-subtle)" : "none",
        alignItems: "start",
      }}
    >
      <div>
        <div style={{ font: "500 13px/1.2 var(--font-geist-sans)", color: "var(--sr-fg)" }}>{label}</div>
        {hint && (
          <div style={{ marginTop: 4, font: "400 12px/1.4 var(--font-geist-sans)", color: "var(--sr-fg-subtle)" }}>
            {hint}
          </div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function SectionFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "12px 20px",
        borderTop: "1px solid var(--sr-border-subtle)",
        background: "var(--sr-bg)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "flex-end",
      }}
    >
      {children}
    </div>
  );
}

function PersoSection({ profile, email }: { profile: ProfileData | null; email: string }) {
  const [state, formAction, pending] = useActionState(updateProfile, undefined);

  return (
    <PrSection id="perso" title="Informations personnelles" subtitle="Visibles uniquement par vous.">
      <form action={formAction}>
        {state?.error && (
          <div
            style={{
              margin: "12px 20px 0",
              padding: "10px 14px",
              background: "var(--sr-danger-bg)",
              border: "1px solid var(--sr-danger-border)",
              borderRadius: 6,
              color: "var(--sr-danger)",
              font: "500 12px/1.4 var(--font-geist-sans)",
            }}
          >
            {state.error}
          </div>
        )}
        {state?.success && (
          <div
            style={{
              margin: "12px 20px 0",
              padding: "10px 14px",
              background: "var(--sr-success-bg)",
              border: "1px solid var(--sr-success-border)",
              borderRadius: 6,
              color: "var(--sr-mint-300)",
              font: "500 12px/1.4 var(--font-geist-sans)",
            }}
          >
            Profil mis à jour avec succès.
          </div>
        )}

        <FormRow label="Prénom">
          <input
            name="first_name"
            defaultValue={profile?.first_name ?? ""}
            placeholder="Brice"
            style={{ height: 36, minHeight: 36, maxWidth: 360 }}
          />
        </FormRow>
        <FormRow label="Nom">
          <input
            name="last_name"
            defaultValue={profile?.last_name ?? ""}
            placeholder="Mbarga"
            style={{ height: 36, minHeight: 36, maxWidth: 360 }}
          />
        </FormRow>
        <FormRow label="Nom de l'entreprise" hint="Apparaît sur les factures envoyées aux clients.">
          <input
            name="company_name"
            defaultValue={profile?.company_name ?? ""}
            placeholder="ex. Brice Streaming"
            style={{ height: 36, minHeight: 36, maxWidth: 360 }}
          />
        </FormRow>
        <FormRow label="Email" hint="Utilisé pour la connexion (non modifiable ici).">
          <input value={email} disabled style={{ height: 36, minHeight: 36, maxWidth: 360, opacity: 0.6 }} />
        </FormRow>
        <FormRow label="Téléphone WhatsApp" hint="Vos clients vous joindront sur ce numéro.">
          <input
            name="phone"
            type="tel"
            defaultValue={profile?.phone ?? ""}
            placeholder="+237 6 78 02 14 88"
            style={{
              height: 36,
              minHeight: 36,
              maxWidth: 360,
              fontFamily: "var(--font-geist-mono)",
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </FormRow>
        <FormRow label="Ville" divider={false}>
          <input
            name="city"
            defaultValue={profile?.city ?? ""}
            placeholder="Yaoundé"
            style={{ height: 36, minHeight: 36, maxWidth: 360 }}
          />
        </FormRow>
        <SectionFooter>
          <button type="submit" disabled={pending} style={{ minHeight: 34, height: 34 }}>
            <Icon name="check" size={13} /> {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </SectionFooter>
      </form>
    </PrSection>
  );
}

function BizSection({ city }: { city: string }) {
  return (
    <PrSection id="biz" title="Mon activité" subtitle="Paramètres régionaux de votre espace de revente.">
      <FormRow label="Devise" hint="Tous vos montants sont affichés en FCFA.">
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            height: 36,
            padding: "0 12px",
            background: "var(--sr-bg)",
            border: "1px solid var(--sr-border)",
            borderRadius: 6,
            maxWidth: 220,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: 4,
              background: "var(--sr-surface-3)",
              font: "700 10px/1 var(--font-geist-sans)",
              color: "var(--sr-fg-strong)",
            }}
          >
            FR
          </span>
          <span style={{ font: "500 13px/1 var(--font-geist-sans)", flex: 1 }}>FCFA (XAF)</span>
          <Icon name="check" size={13} style={{ color: "var(--sr-mint-300)" }} />
        </div>
      </FormRow>
      <FormRow label="Fuseau horaire" divider={false}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            height: 36,
            padding: "0 12px",
            background: "var(--sr-bg)",
            border: "1px solid var(--sr-border)",
            borderRadius: 6,
          }}
        >
          <Icon name="dashboard" size={13} style={{ color: "var(--sr-fg-subtle)" }} />
          <span style={{ font: "500 13px/1 var(--font-geist-sans)" }}>
            {city ? `Africa/Douala (${city})` : "Africa/Douala"}
          </span>
          <span
            style={{
              font: "500 11px/1 var(--font-geist-mono)",
              color: "var(--sr-fg-subtle)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            (GMT+1)
          </span>
        </div>
      </FormRow>
    </PrSection>
  );
}

function SecuSection() {
  return (
    <PrSection id="secu" title="Sécurité" subtitle="Protégez votre compte et vos données clients.">
      <FormRow label="Mot de passe" hint="Modifiez votre mot de passe depuis Supabase Auth.">
        <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 360 }}>
          <span style={{ font: "500 13px/1 var(--font-geist-mono)", color: "var(--sr-fg)", letterSpacing: "0.2em" }}>
            ••••••••••••
          </span>
          <div style={{ flex: 1 }} />
          <button type="button" className="secondary" style={{ minHeight: 30, height: 30, fontSize: "0.78rem" }}>
            Changer
          </button>
        </div>
      </FormRow>
      <FormRow label="Sessions actives" hint="Une seule session par appareil." divider={false}>
        <div
          style={{
            padding: "10px 12px",
            background: "var(--sr-bg)",
            border: "1px solid var(--sr-border-subtle)",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "var(--sr-surface-2)",
              border: "1px solid var(--sr-border-subtle)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--sr-fg-muted)",
            }}
          >
            <Icon name="dashboard" size={13} />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                font: "500 13px/1.2 var(--font-geist-sans)",
                color: "var(--sr-fg-strong)",
              }}
            >
              Cette session
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "0 6px",
                  height: 18,
                  background: "var(--sr-success-bg)",
                  border: "1px solid var(--sr-success-border)",
                  borderRadius: 4,
                  color: "var(--sr-success)",
                  font: "500 10px/1 var(--font-geist-sans)",
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background: "var(--sr-mint-500)",
                    boxShadow: "0 0 6px var(--sr-mint-500)",
                  }}
                />
                active
              </span>
            </div>
          </div>
        </div>
      </FormRow>
    </PrSection>
  );
}

function PlanSection({ plan }: { plan: string }) {
  const isPro = plan !== "free";
  return (
    <PrSection id="plan" title="Mon plan Subresell" subtitle="Votre abonnement à l'outil. Distinct des comptes fournisseurs.">
      <div style={{ padding: "16px 20px", display: "flex", gap: 16 }}>
        <div
          style={{
            flex: 1,
            padding: 18,
            background: isPro
              ? "linear-gradient(135deg, rgba(41,220,133,0.10) 0%, rgba(92,200,255,0.06) 50%, rgba(179,136,255,0.08) 100%), var(--sr-bg)"
              : "var(--sr-bg)",
            border: isPro ? "1px solid rgba(255,255,255,0.10)" : "1px solid var(--sr-border-subtle)",
            borderRadius: 10,
            boxShadow: "var(--sr-hairline-top)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: "500 10px/1 var(--font-geist-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: isPro ? "var(--sr-mint-300)" : "var(--sr-fg-muted)",
              marginBottom: 14,
            }}
          >
            <Icon name="zap" size={11} /> Plan actuel
          </div>
          <div
            style={{
              font: "600 24px/1 var(--font-geist-sans)",
              color: "var(--sr-fg-strong)",
              letterSpacing: "-0.018em",
              textTransform: "capitalize",
            }}
          >
            {plan}
          </div>
          <div
            style={{
              marginTop: 6,
              font: "400 13px/1.4 var(--font-geist-sans)",
              color: "var(--sr-fg-muted)",
            }}
          >
            {isPro
              ? "Clients illimités, exports CSV, support prioritaire WhatsApp."
              : "Plan gratuit avec limites. Passez à Pro pour débloquer toutes les fonctions."}
          </div>
        </div>
      </div>

      <SectionFooter>
        {!isPro && (
          <button type="button" style={{ minHeight: 34, height: 34 }}>
            <Icon name="zap" size={13} /> Passer en Pro
          </button>
        )}
      </SectionFooter>
    </PrSection>
  );
}

function DangerSection() {
  return (
    <PrSection id="danger" danger title="Zone de danger" subtitle="Ces actions sont irréversibles. À utiliser avec précaution.">
      <DangerRow
        title="Exporter toutes mes données"
        hint="Téléchargez un fichier CSV avec clients, comptes fournisseurs, paiements."
        action={
          <button type="button" className="secondary" style={{ minHeight: 30, height: 30, fontSize: "0.78rem" }}>
            <Icon name="download" size={12} /> Exporter
          </button>
        }
      />
      <DangerRow
        title="Supprimer définitivement mon compte"
        hint="Toutes vos données seront effacées sous 30 jours. Action irréversible."
        last
        action={
          <button type="button" className="danger" style={{ minHeight: 30, height: 30, fontSize: "0.78rem" }}>
            Supprimer le compte
          </button>
        }
      />
    </PrSection>
  );
}

function DangerRow({
  title,
  hint,
  action,
  last,
}: {
  title: string;
  hint: string;
  action: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 20px",
        borderBottom: last ? "none" : "1px solid var(--sr-border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "500 13px/1.2 var(--font-geist-sans)", color: "var(--sr-fg-strong)" }}>{title}</div>
        <div style={{ marginTop: 4, font: "400 12px/1.4 var(--font-geist-sans)", color: "var(--sr-fg-subtle)" }}>
          {hint}
        </div>
      </div>
      {action}
    </div>
  );
}
