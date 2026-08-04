import { updateReminderStatus } from "@/app/actions/reminders";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
const statusLabels: Record<string,string> = { prepared:"Préparé",sent:"Envoyé",replied:"Répondu",paid:"Payé" };

export default async function RemindersPage() {
  const user = await getUser(); if (!user) return null; const db=createSupabaseAdmin();
  const limitDate=new Date(); limitDate.setDate(limitDate.getDate()+7); const until=limitDate.toISOString().slice(0,10);
  const [{data:subs},{data:tracked}] = await Promise.all([
    db.from("client_subscriptions").select("id,client_id,end_date,price,status,client:clients(first_name,last_name,phone,archived_at),slot:account_slots(account:provider_accounts(service_name))").eq("user_id",user.id).neq("status","cancelled").lte("end_date",until).order("end_date"),
    db.from("client_reminders").select("subscription_id,status").eq("user_id",user.id)
  ]);
  const trackedMap=new Map((tracked??[]).map(x=>[x.subscription_id,x.status]));
  return <><div className="page-header"><div><p className="eyebrow">Suivi commercial</p><h1>Relances clients</h1><p>Messages WhatsApp préparés pour les échéances proches. Vérifiez toujours le texte avant l’envoi.</p></div></div><div className="panel reminder-list">
    {(subs??[]).filter(s=>!(s.client as unknown as {archived_at?:string|null})?.archived_at).map(s=>{const client=s.client as unknown as {first_name:string;last_name:string|null;phone:string|null}; const service=((s.slot as unknown as {account?:{service_name?:string}})?.account?.service_name)??"votre abonnement"; const days=Math.ceil((new Date(s.end_date+"T12:00:00").getTime()-Date.now())/86400000); const message=`Bonjour ${client.first_name}, votre abonnement ${service} ${days<0?`a expiré il y a ${Math.abs(days)} jour(s)`:`expire dans ${days} jour(s), le ${new Date(s.end_date+"T12:00:00").toLocaleDateString("fr-FR")}`}. Souhaitez-vous le renouveler ?`; const wa=client.phone?`https://wa.me/${client.phone.replace(/\D/g,"")}?text=${encodeURIComponent(message)}`:""; const current=trackedMap.get(s.id)??"prepared"; return <article className="reminder-row" key={s.id}><div><strong>{client.first_name} {client.last_name}</strong><p>{service} · {days<0?`${Math.abs(days)} j de retard`:`J-${days}`} · {statusLabels[current]}</p><blockquote>{message}</blockquote></div><div className="reminder-actions">{wa?<a className="primary" target="_blank" rel="noreferrer" href={wa}>Ouvrir WhatsApp</a>:<span className="badge badge--danger">Téléphone manquant</span>}<form action={updateReminderStatus}><input type="hidden" name="subscription_id" value={s.id}/><input type="hidden" name="client_id" value={s.client_id}/><input type="hidden" name="message" value={message}/><select name="status" defaultValue={current}>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button className="secondary">Enregistrer</button></form></div></article>})}
    {!subs?.length&&<div className="empty-state">Aucune relance prévue dans les 7 prochains jours.</div>}
  </div></>;
}
