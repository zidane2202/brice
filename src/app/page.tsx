import { addClientSubscription, addProviderSubscription } from "@/app/actions";
import { PushManager } from "@/components/PushManager";
import { SubscriptionTable } from "@/components/SubscriptionTable";
import { daysUntil, toDateInputValue } from "@/lib/dates";
import { createSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";
import type { Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getSubscriptions() {
  if (!isSupabaseConfigured()) {
    return [] as Subscription[];
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      kind,
      service_name,
      start_date,
      end_date,
      status,
      client_id,
      created_at,
      client:clients (
        id,
        first_name,
        last_name,
        email,
        phone,
        created_at
      )
    `,
    )
    .order("end_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as Subscription[];
}

export default async function Home() {
  const subscriptions = await getSubscriptions();
  const activeSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "active",
  );
  const providerSubscriptions = activeSubscriptions.filter(
    (subscription) => subscription.kind === "provider",
  );
  const clientSubscriptions = activeSubscriptions.filter(
    (subscription) => subscription.kind === "client",
  );
  const urgentSubscriptions = activeSubscriptions.filter((subscription) => {
    const days = daysUntil(subscription.end_date);
    return days >= 0 && days <= 3;
  });
  const expiredSubscriptions = activeSubscriptions.filter(
    (subscription) => daysUntil(subscription.end_date) < 0,
  );
  const today = toDateInputValue();
  const configured = isSupabaseConfigured();

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Gestion reseller</p>
          <h1>Abonnements clients et fournisseurs</h1>
          <p>
            Suivez Netflix, Spotify et vos autres services, calculez les fins a
            30 jours, et recevez des rappels push de J-3 jusqu&apos;au dernier jour.
          </p>
        </div>
        <PushManager />
      </section>

      {!configured ? (
        <section className="setup">
          <h2>Connexion Supabase requise</h2>
          <p>
            Ajoute les variables `.env.local`, lance le SQL dans Supabase, puis
            redemarre Next.js.
          </p>
          <code>NEXT_PUBLIC_SUPABASE_URL</code>
          <code>SUPABASE_SERVICE_ROLE_KEY</code>
          <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>
          <code>VAPID_PRIVATE_KEY</code>
          <code>CRON_SECRET</code>
        </section>
      ) : null}

      <section className="stats" aria-label="Resume">
        <div>
          <span>Total actifs</span>
          <strong>{activeSubscriptions.length}</strong>
        </div>
        <div>
          <span>A renouveler</span>
          <strong>{urgentSubscriptions.length}</strong>
        </div>
        <div>
          <span>Expires</span>
          <strong>{expiredSubscriptions.length}</strong>
        </div>
        <div>
          <span>Clients</span>
          <strong>{clientSubscriptions.length}</strong>
        </div>
      </section>

      <section className="grid two">
        <form action={addProviderSubscription} className="panel">
          <div>
            <p className="eyebrow">Vos comptes</p>
            <h2>Ajouter un abonnement fournisseur</h2>
          </div>
          <label>
            Service
            <input
              name="service_name"
              placeholder="Netflix, Spotify, Prime..."
              required
            />
          </label>
          <label>
            Date de debut
            <input name="start_date" type="date" defaultValue={today} required />
          </label>
          <p className="hint">La date de fin est calculee automatiquement +30j.</p>
          <button type="submit">Ajouter</button>
        </form>

        <form action={addClientSubscription} className="panel">
          <div>
            <p className="eyebrow">Clients</p>
            <h2>Ajouter un client abonne</h2>
          </div>
          <div className="fields two-cols">
            <label>
              Nom
              <input name="last_name" placeholder="Nom" required />
            </label>
            <label>
              Prenom
              <input name="first_name" placeholder="Prenom" required />
            </label>
          </div>
          <div className="fields two-cols">
            <label>
              Mail
              <input name="email" type="email" placeholder="client@mail.com" />
            </label>
            <label>
              Telephone
              <input name="phone" type="tel" placeholder="+237..." />
            </label>
          </div>
          <div className="fields two-cols">
            <label>
              Service
              <input name="service_name" placeholder="Netflix" required />
            </label>
            <label>
              Date de debut
              <input
                name="start_date"
                type="date"
                defaultValue={today}
                required
              />
            </label>
          </div>
          <p className="hint">
            La fin client est aussi calculee automatiquement a 30 jours.
          </p>
          <button type="submit">Ajouter le client</button>
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Priorite</p>
            <h2>Fin proche</h2>
          </div>
          <span>{urgentSubscriptions.length} rappel(s)</span>
        </div>
        <SubscriptionTable
          subscriptions={urgentSubscriptions}
          emptyLabel="Aucun abonnement ne finit dans les 3 prochains jours."
        />
      </section>

      <section className="grid two">
        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Fournisseurs</p>
              <h2>Vos abonnements</h2>
            </div>
          </div>
          <SubscriptionTable
            subscriptions={providerSubscriptions}
            emptyLabel="Aucun abonnement fournisseur actif."
          />
        </div>
        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Relances</p>
              <h2>Clients actifs</h2>
            </div>
          </div>
          <SubscriptionTable
            subscriptions={clientSubscriptions}
            emptyLabel="Aucun client actif pour le moment."
          />
        </div>
      </section>
    </main>
  );
}
