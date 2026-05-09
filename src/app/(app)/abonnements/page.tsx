import { addProviderAccount } from "@/app/actions/accounts";
import { AccountCard } from "@/components/AccountCard";
import { toDateInputValue } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { ProviderAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getAccounts(userId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("provider_accounts")
    .select(`id, service_name, max_slots, start_date, end_date, duration_months, cost, status, created_at,
      account_slots(id)`)
    .eq("user_id", userId)
    .order("end_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((a: any) => ({
    ...a,
    used_slots: (a.account_slots as { id: string }[]).filter(Boolean).length,
  }));
}

export default async function AbonnementsPage() {
  const user = await getUser();
  if (!user) return null;

  const accounts = await getAccounts(user.id);
  const today = toDateInputValue();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Vos comptes</p>
          <h1>Mes abonnements</h1>
        </div>
      </div>

      <div className="panel">
        <div>
          <p className="eyebrow">Ajouter</p>
          <h2>Nouveau compte provider</h2>
        </div>
        <form action={addProviderAccount} className="fields">
          <div className="fields two-cols">
            <label>
              Service
              <input name="service_name" placeholder="Netflix, Spotify..." required />
            </label>
            <label>
              Nombre de profils
              <input name="max_slots" type="number" min="1" max="20" defaultValue="5" required />
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
          <label>
            Coût payé (FCFA)
            <input name="cost" type="number" placeholder="Ex: 5000" />
          </label>
          <button type="submit">Ajouter le compte</button>
        </form>
      </div>

      <div>
        <p className="eyebrow">Liste ({accounts.length})</p>
        <div className="accounts-grid">
          {accounts.length === 0
            ? <p className="empty">Aucun compte provider. Ajoutez-en un ci-dessus.</p>
            : accounts.map((account) => (
                <AccountCard key={account.id} account={account as ProviderAccount & { used_slots: number }} />
              ))
          }
        </div>
      </div>
    </>
  );
}
