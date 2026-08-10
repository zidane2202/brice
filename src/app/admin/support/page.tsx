import { replySupportTicket } from "@/app/actions/support";
import { listAllAuthUsers } from "@/lib/auth-users";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type TicketMessage = { body: string; author_role: string; created_at: string };

export default async function AdminSupportPage() {
  const db = createSupabaseAdmin();
  const [{ data: tickets }, users] = await Promise.all([
    db
      .from("support_tickets")
      .select("id,user_id,subject,status,priority,created_at,support_messages(body,author_role,created_at)")
      .order("updated_at", { ascending: false })
      .limit(100),
    listAllAuthUsers(db),
  ]);
  const emailMap = new Map(users.map((user) => [user.id, user.email ?? "—"]));

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Centre d’assistance</p>
          <h1>Tickets support</h1>
        </div>
      </div>
      <div className="ticket-list">
        {(tickets ?? []).map((ticket) => {
          const messages = (ticket.support_messages as unknown as TicketMessage[]) ?? [];
          const sellerEmail = emailMap.get(ticket.user_id) ?? ticket.user_id;
          return (
            <article className="panel ticket-card" key={ticket.id}>
              <header>
                <strong>{ticket.subject}</strong>
                <span className="badge">{ticket.priority} · {ticket.status}</span>
              </header>
              <p style={{ margin: "0 0 10px", color: "var(--sr-fg-subtle)", fontSize: 13 }}>{sellerEmail}</p>
              {messages.map((message, index) => (
                <div className={`ticket-message ticket-message--${message.author_role}`} key={`${ticket.id}-${index}`}>
                  <small>{message.author_role === "admin" ? "Support" : sellerEmail}</small>
                  <p>{message.body}</p>
                </div>
              ))}
              <form action={replySupportTicket} className="ticket-reply">
                <input type="hidden" name="ticket_id" value={ticket.id} />
                <textarea name="body" required placeholder="Réponse humaine…" />
                <select name="status" defaultValue="in_progress">
                  <option value="in_progress">En traitement</option>
                  <option value="resolved">Résolu</option>
                  <option value="open">Ouvert</option>
                </select>
                <button className="primary">Répondre</button>
              </form>
            </article>
          );
        })}
        {!tickets?.length && <div className="panel empty-state">Aucun ticket pour le moment.</div>}
      </div>
    </>
  );
}
