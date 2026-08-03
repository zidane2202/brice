import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PLAN_PRICES_FCFA } from "@/lib/plans";
import { supportWhatsAppHref } from "@/lib/support";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

function formatPrice(n: number, locale: string) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR").format(n);
}

export async function LandingPage({ locale }: { locale: string }) {
  const t = await getTranslations("Landing");
  const contactHref = supportWhatsAppHref(
    locale === "en"
      ? "Hi, I'd like to learn more about SubResell."
      : "Bonjour, je souhaite en savoir plus sur SubResell."
  );
  const proContact = supportWhatsAppHref(
    locale === "en"
      ? `Hi, I want to upgrade to Pro (${PLAN_PRICES_FCFA.pro} FCFA/month).`
      : `Bonjour, je souhaite passer au plan Pro (${PLAN_PRICES_FCFA.pro} FCFA/mois).`
  );
  const businessContact = supportWhatsAppHref(
    locale === "en"
      ? "Hi, I'm interested in the Business plan."
      : "Bonjour, je suis intéressé par le plan Business."
  );

  const freeFeatures = t.raw("pricing.free.features") as string[];
  const proFeatures = t.raw("pricing.pro.features") as string[];
  const proExtras = t.raw("pricing.pro.extras") as string[];
  const businessFeatures = t.raw("pricing.business.features") as string[];

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <a href="#top" className="landing-brand">
            <span className="landing-mark" aria-hidden>
              S
            </span>
            <span>{t("hero.brand")}</span>
          </a>
          <div className="landing-nav-actions">
            <LocaleSwitcher />
            <Link href="/login" className="landing-btn landing-btn--solid">
              {t("nav.login")}
            </Link>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="landing-hero">
          <div className="landing-hero-veil" aria-hidden />
          <div className="landing-hero-grid" aria-hidden />
          <div className="landing-hero-inner">
            <p className="landing-eyebrow landing-anim" style={{ animationDelay: "0.05s" }}>
              {t("hero.eyebrow")}
            </p>
            <h1 className="landing-display landing-anim" style={{ animationDelay: "0.12s" }}>
              {t("hero.brand")}
            </h1>
            <p className="landing-hero-title landing-anim" style={{ animationDelay: "0.2s" }}>
              {t("hero.title")}
            </p>
            <p className="landing-hero-sub landing-anim" style={{ animationDelay: "0.28s" }}>
              {t("hero.subtitle")}
            </p>
            <div className="landing-hero-cta landing-anim" style={{ animationDelay: "0.36s" }}>
              <Link href="/signup" className="landing-btn landing-btn--solid landing-btn--lg">
                {t("hero.ctaPrimary")}
              </Link>
              <a href="#pricing" className="landing-btn landing-btn--ghost landing-btn--lg">
                {t("hero.ctaSecondary")}
              </a>
            </div>
          </div>
        </section>

        <section className="landing-section" id="product">
          <p className="landing-eyebrow">{t("product.eyebrow")}</p>
          <h2 className="landing-h2">{t("product.title")}</h2>
          <div className="landing-features">
            {(["accounts", "clients", "cash"] as const).map((key) => (
              <article key={key} className="landing-feature">
                <h3>{t(`product.items.${key}.title`)}</h3>
                <p>{t(`product.items.${key}.body`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-section--pricing" id="pricing">
          <p className="landing-eyebrow">{t("pricing.eyebrow")}</p>
          <h2 className="landing-h2">{t("pricing.title")}</h2>
          <p className="landing-pricing-hint">{t("pricing.compareHint")}</p>

          <div className="landing-pricing">
            <article className="landing-plan">
              <h3>{t("pricing.free.name")}</h3>
              <p className="landing-plan-tag">{t("pricing.free.tagline")}</p>
              <p className="landing-price">
                {formatPrice(PLAN_PRICES_FCFA.free, locale)}
                <span>
                  {" "}
                  FCFA
                  {t("pricing.perMonth")}
                </span>
              </p>
              <ul className="landing-plan-list">
                {freeFeatures.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link href="/signup" className="landing-btn landing-btn--ghost">
                {t("pricing.free.cta")}
              </Link>
            </article>

            <article className="landing-plan landing-plan--featured">
              <span className="landing-plan-badge">{t("pricing.pro.badge")}</span>
              <h3>{t("pricing.pro.name")}</h3>
              <p className="landing-plan-tag">{t("pricing.pro.tagline")}</p>
              <p className="landing-price">
                {formatPrice(PLAN_PRICES_FCFA.pro, locale)}
                <span>
                  {" "}
                  FCFA
                  {t("pricing.perMonth")}
                </span>
              </p>
              <ul className="landing-plan-list">
                {proFeatures.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="landing-plan-extras-box">
                <p className="landing-plan-extras-title">{t("pricing.pro.extrasTitle")}</p>
                <ul className="landing-plan-list landing-plan-list--compact">
                  {proExtras.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <a href={proContact} className="landing-btn landing-btn--solid" target="_blank" rel="noreferrer">
                {t("pricing.pro.cta")}
              </a>
            </article>

            <article className="landing-plan">
              <h3>{t("pricing.business.name")}</h3>
              <p className="landing-plan-tag">{t("pricing.business.tagline")}</p>
              <p className="landing-price">
                {formatPrice(PLAN_PRICES_FCFA.business, locale)}
                <span>
                  {" "}
                  FCFA
                  {t("pricing.perMonth")}
                </span>
              </p>
              <ul className="landing-plan-list">
                {businessFeatures.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <a
                href={businessContact}
                className="landing-btn landing-btn--ghost"
                target="_blank"
                rel="noreferrer"
              >
                {t("pricing.business.cta")}
              </a>
            </article>
          </div>
        </section>

        <section className="landing-section" id="contact">
          <p className="landing-eyebrow">{t("contact.eyebrow")}</p>
          <h2 className="landing-h2">{t("contact.title")}</h2>
          <p className="landing-lead">{t("contact.body")}</p>
          <a
            href={contactHref}
            className="landing-btn landing-btn--solid landing-btn--lg"
            target="_blank"
            rel="noreferrer"
          >
            {t("contact.cta")}
          </a>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <strong>{t("hero.brand")}</strong>
            <p>{t("footer.tagline")}</p>
          </div>
          <div className="landing-footer-links">
            <Link href="/login">{t("footer.login")}</Link>
            <Link href="/signup">{t("footer.signup")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
