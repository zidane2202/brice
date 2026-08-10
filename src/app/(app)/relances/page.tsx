import { updateReminderStatus } from "@/app/actions/reminders";
import { ActionForm } from "@/components/ui/ActionForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { addDays, todayDateOnly } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  prepared: "Préparé",
  sent: "Envoyé",
  replied: "Répondu",
  paid: "Payé",
};

export default async function RemindersPage() {
  const user = await getUser();
  if (!user) return null;
  const db = createSupabaseAdmin();
  const today = todayDateOnly();
  const until = addDays(today, 7);
  const since = addDays(today, -14);
  const [{ data: subs }, { data: tracked }] = await Promise.all([
    db
      .from("client_subscriptions")
      .select("id,client_id,end_date,price,status,client:clients(first_name,last_name,phone,archived_at),slot:account_slots(account:provider_accounts(service_name))")
      .eq("user_id", user.id)
      .neq("status", "cancelled")
      .gte("end_date", since)
      .lte("end_date", until)
      .order("end_date"),
    db.from("client_reminders").select("subscription_id,status").eq("user_id", user.id),
  ]);
  const trackedMap = new Map((tracked ?? []).map((row) => [row.subscription_id, row.status]));
  const rows = (subs ?? []).filter(
    (sub) => !(sub.client as unknown as { archived_at?: string | null })?.archived_at,
  );

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Suivi commercial</p>
          <h1>Relances clients</h1>
          <p>Messages WhatsApp préparés pour les échéances proches. Vérifiez toujours le texte avant l’envoi.</p>
        </div>
      </div>
      <div className="panel reminder-list">
        {rows.map((sub) => {
          const client = sub.client as unknown as { first_name: string; last_name: string | null; phone: string | null };
          const service =
            ((sub.slot as unknown as { account?: { service_name?: string } })?.account?.service_name) ??
            "votre abonnement";
          const days = Math.ceil((new Date(`${sub.end_date}T12:00:00`).getTime() - Date.now()) / 86400000);
          const message = `Bonjour ${client.first_name}, votre abonnement ${service} ${
            days < 0
              ? `a expiré il y a ${Math.abs(days)} jour(s)`
              : `expire dans ${days} jour(s), le ${new Date(`${sub.end_date}T12:00:00`).toLocaleDateString("fr-FR")}`
          }. Souhaitez-vous le renouveler ?`;
          const wa = client.phone
            ? `https://wa.me/${client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
            : "";
          const current = trackedMap.get(sub.id) ?? "prepared";
          return (
            <article className="reminder-row" key={sub.id}>
              <div>
                <strong>{client.first_name} {client.last_name}</strong>
                <p>
                  {service} · {days < 0 ? `${Math.abs(days)} j de retard` : `J-${days}`} · {statusLabels[current]}
                </p>
                <blockquote>{message}</blockquote>
              </div>
              <div className="reminder-actions">
                {wa ? (
                  <a className="primary" target="_blank" rel="noreferrer" href={wa}>Ouvrir WhatsApp</a>
                ) : (
                  <span className="badge badge--danger">Téléphone manquant</span>
                )}
                <ActionForm
                  action={updateReminderStatus}
                  successMessage="Statut de relance enregistré"
                  errorMessage="Enregistrement impossible"
                >
                  <input type="hidden" name="subscription_id" value={sub.id} />
                  <input type="hidden" name="client_id" value={sub.client_id} />
                  <input type="hidden" name="message" value={message} />
                  <select name="status" defaultValue={current}>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <SubmitButton className="secondary">Enregistrer</SubmitButton>
                </ActionForm>
              </div>
            </article>
          );
        })}
        {!rows.length && (
          <EmptyState
            title="Aucune relance prévue"
            description="Les échéances des 7 prochains jours (et retards récents) apparaîtront ici."
          />
        )}
      </div>
    </>
  );
}
