import Link from "next/link";
import { restoreArchivedClient } from "@/app/actions/clients";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function ClientArchivesPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const user = await getUser(); if (!user) return null;
  const params = await searchParams; const page = Math.max(1, Number(params.page) || 1); const size = 25; const q = (params.q ?? "").trim();
  const db = createSupabaseAdmin();
  let query = db.from("clients").select("id,first_name,last_name,email,phone,archived_at", { count: "exact" }).eq("user_id", user.id).not("archived_at", "is", null).order("archived_at", { ascending: false });
  if (q) query = query.or(`first_name.ilike.%${q.replaceAll(",", "")}%,last_name.ilike.%${q.replaceAll(",", "")}%,email.ilike.%${q.replaceAll(",", "")}%,phone.ilike.%${q.replaceAll(",", "")}%`);
  const { data, count, error } = await query.range((page - 1) * size, page * size - 1); if (error) throw new Error(error.message);
  const pages = Math.max(1, Math.ceil((count ?? 0) / size));
  return <>
    <div className="page-header"><div><p className="eyebrow">Corbeille sécurisée</p><h1>Clients archivés</h1><p>Les données et l’historique restent conservés jusqu’à leur restauration.</p></div><Link href="/clients" className="secondary">← Mes clients</Link></div>
    <div className="panel">
      <form className="archive-search"><input name="q" defaultValue={q} placeholder="Rechercher un client archivé…"/><button className="secondary">Rechercher</button></form>
      <div className="archive-list">{(data ?? []).map((client) => <article key={client.id} className="archive-row"><div><strong>{[client.first_name, client.last_name].filter(Boolean).join(" ")}</strong><p>{client.phone || client.email || "Aucune coordonnée"} · archivé le {new Date(client.archived_at!).toLocaleDateString("fr-FR")}</p></div><form action={restoreArchivedClient.bind(null, client.id)}><button className="secondary">Restaurer</button></form></article>)}{!data?.length && <div className="empty-state">Aucun client archivé.</div>}</div>
      {pages > 1 && <nav className="server-pagination" aria-label="Pagination"><Link aria-disabled={page <= 1} href={`/clients/archives?page=${Math.max(1,page-1)}&q=${encodeURIComponent(q)}`}>← Précédent</Link><span>Page {page} / {pages}</span><Link aria-disabled={page >= pages} href={`/clients/archives?page=${Math.min(pages,page+1)}&q=${encodeURIComponent(q)}`}>Suivant →</Link></nav>}
    </div>
  </>;
}
