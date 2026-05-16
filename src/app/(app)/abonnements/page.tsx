import { AccountCard } from "@/components/AccountCard";
import { AddAccountForm } from "@/components/AddAccountForm";
import { toDateInputValue } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { ProviderAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getAccounts(userId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("provider_accounts")
    .select(`id, service_name, label, max_slots, start_date, end_date, duration_months, cost, status, created_at,
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

  // Numérotation stable par date de création
  const serviceCount: Record<string, number> = {};
  for (const a of accounts) {
    serviceCount[a.service_name] = (serviceCount[a.service_name] ?? 0) + 1;
  }
  const serviceIndex: Record<string, number> = {};
  const displayNames: Record<string, string> = {};
  for (const a of [...accounts].sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime())) {
    if (serviceCount[a.service_name] > 1) {
      serviceIndex[a.service_name] = (serviceIndex[a.service_name] ?? 0) + 1;
      displayNames[a.id] = `${a.service_name} (${serviceIndex[a.service_name]})`;
    } else {
      displayNames[a.id] = a.service_name;
    }
  }

  const byName = (x: { id: string }, y: { id: string }) =>
    displayNames[x.id].localeCompare(displayNames[y.id]);

  const active = accounts.filter((a) => a.status === "active").sort(byName);
  const inactive = accounts.filter((a) => a.status === "inactive").sort(byName);

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
        <AddAccountForm today={today} />
      </div>

      <div className="accounts-grid">
        {active.length === 0
          ? <p className="empty">Aucun compte actif.</p>
          : active.map((account) => (
              <AccountCard key={account.id} account={account as ProviderAccount & { used_slots: number }} displayName={displayNames[account.id]} />
            ))
        }
      </div>

      {inactive.length > 0 && (
        <>
          <div className="accounts-divider">
            <span>Inactifs</span>
          </div>
          <div className="accounts-grid accounts-grid--inactive">
            {inactive.map((account) => (
              <AccountCard key={account.id} account={account as ProviderAccount & { used_slots: number }} displayName={displayNames[account.id]} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
