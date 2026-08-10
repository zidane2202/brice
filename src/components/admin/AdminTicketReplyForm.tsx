"use client";

import { replySupportTicket } from "@/app/actions/support";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function AdminTicketReplyForm({ ticketId }: { ticketId: string }) {
  return (
    <ActionForm
      action={replySupportTicket}
      successMessage="Réponse envoyée"
      errorMessage="Réponse impossible"
      className="ticket-reply"
    >
      <input type="hidden" name="ticket_id" value={ticketId} />
      <textarea name="body" required placeholder="Réponse humaine…" />
      <select name="status" defaultValue="in_progress">
        <option value="in_progress">En traitement</option>
        <option value="resolved">Résolu</option>
        <option value="open">Ouvert</option>
      </select>
      <SubmitButton className="primary">Répondre</SubmitButton>
    </ActionForm>
  );
}
