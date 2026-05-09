import { addClientWithSubscription } from "@/app/actions/clients";
import { ClientTable } from "@/components/ClientTable";
import { toDateInputValue } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { ClientSubscription, AccountSlot } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getData(userId: string) {
  const supabase = createSupabaseAdmin();

  const [subsResult, slotsResult] = await Promise.all([
    supabase
      .from("client_subscriptions")
      .select(`
        *,
        client:clients(*),
        slot:account_slots(
          id, slot_number, label,
          account:provider_accounts(id, service_name)
        )
      `)
      .eq("user_id", userId)
      .order("end_date", { ascending: true }),
    supabase
      .from("account_slots")
      .select(`
        id, slot_number, label,
        account:provider_accounts!inner(id, service_name, status, user_id)
      `)
      .eq("provider_accounts.user_id", userId)
      .eq("provider_accounts.status", "active"),
  ]);

  if (subsResult.error) throw new Error(subsResult.error.message);
  if (slotsResult.error) throw new Error(slotsResult.error.message);

  const occupiedSlotIds = new Set(
    (subsResult.data ?? [])
      .filter((s) => s.status === "active")
      .map((s) => s.slot_id)
  );

  const freeSlots = (slotsResult.data ?? []).filter(
    (slot) => !occupiedSlotIds.has(slot.id)
  );

  return {
    subscriptions: (subsResult.data ?? []) as unknown as ClientSubscription[],
    freeSlots: freeSlots as unknown as (AccountSlot & { account: { id: string; service_name: string } })[],
  };
}

export default async function ClientsPage() {
  const user = await getUser();
  if (!user) return null;

  const { subscriptions, freeSlots } = await getData(user.id);
  const activeSubscriptions = subscriptions.filter((s) => s.status === "active");
  const today = toDateInputValue();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Vos clients</p>
          <h1>Mes clients</h1>
        </div>
      </div>

      <div className="panel">
        <div>
          <p className="eyebrow">Ajouter</p>
          <h2>Nouveau client</h2>
        </div>
        <form action={addClientWithSubscription} className="fields">
          <div className="fields two-cols">
            <label>
              Prénom
              <input name="first_name" placeholder="Prénom" required />
            </label>
            <label>
              Nom
              <input name="last_name" placeholder="Nom" required />
            </label>
          </div>
          <div className="fields two-cols">
            <label>
              Téléphone
              <input name="phone" type="tel" placeholder="+237..." />
            </label>
            <label>
              Email
              <input name="email" type="email" placeholder="client@mail.com" />
            </label>
          </div>
          <div className="fields two-cols">
            <label>
              Profil libre
              <select name="slot_id" required className="select-input">
                <option value="">— Choisir un profil —</option>
                {freeSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.account?.service_name} — {slot.label || `Profil ${slot.slot_number}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prix (FCFA)
              <input name="price" type="number" placeholder="Ex: 2000" />
            </label>
          </div>
          <div className="fields two-cols">
            <label>
              Date de début
              <input name="start_date" type="date" defaultValue={today} required />
            </label>
            <label>
              Durée (mois)
              <input name="duration_months" type="number" min="1" max="12" defaultValue="1" required />
            </label>
          </div>
          <button type="submit">Ajouter le client</button>
        </form>
      </div>

      <div className="panel">
        <h2>Clients actifs ({activeSubscriptions.length})</h2>
        <ClientTable subscriptions={activeSubscriptions} />
      </div>
    </>
  );
}
