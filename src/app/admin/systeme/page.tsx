import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const db = createSupabaseAdmin(); const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: job }, { count: sent }, { count: failed }, { count: pushSubs }, { count: tickets }] = await Promise.all([
    db.from("system_job_runs").select("status,details,finished_at").eq("job_name", "reminders").order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("push_delivery_logs").select("id", { count: "exact", head: true }).eq("status", "sent").gte("created_at", since),
    db.from("push_delivery_logs").select("id", { count: "exact", head: true }).in("status", ["failed", "expired"]).gte("created_at", since),
    db.from("push_subscriptions").select("id", { count: "exact", head: true }),
    db.from("support_tickets").select("id", { count: "exact", head: true }).neq("status", "resolved"),
  ]);
  return <><div className="page-header"><div><p className="eyebrow">Exploitation</p><h1>État du système</h1><p>Indicateurs techniques des 30 derniers jours.</p></div><a className="secondary" href="https://sentry.io/issues/" target="_blank" rel="noreferrer">Ouvrir Sentry ↗</a></div><div className="stats-grid stats-grid-five"><SystemMetric label="Dernier cron" value={job ? new Date(job.finished_at).toLocaleString("fr-FR") : "Jamais"} detail={job?.status ?? "Aucune exécution"}/><SystemMetric label="Push réussis" value={String(sent ?? 0)} detail="30 derniers jours"/><SystemMetric label="Push échoués" value={String(failed ?? 0)} detail="expirés inclus"/><SystemMetric label="Appareils push" value={String(pushSubs ?? 0)} detail="abonnements actifs"/><SystemMetric label="Tickets ouverts" value={String(tickets ?? 0)} detail="à traiter"/></div><div className="panel system-actions"><div><strong>Outils d’exploitation</strong><p>Surveillez Sentry, téléchargez régulièrement une sauvegarde et traitez les tickets ouverts.</p></div><Link href="/api/account/export" className="secondary">Télécharger une sauvegarde</Link><Link href="/admin/support" className="secondary">Traiter le support</Link></div></>;
}
function SystemMetric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="stat-card"><p className="stat-card-label">{label}</p><strong className="system-metric-value">{value}</strong><small>{detail}</small></div>; }
