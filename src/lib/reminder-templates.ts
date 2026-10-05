export type ReminderCategory = "today" | "soon3" | "soon7" | "grace" | "expired" | "lapsed" | "balance";
export type TemplateCategory = ReminderCategory | "all";

export type ReminderTemplate = { id: string; category: TemplateCategory | string; name: string; body: string };

export const REMINDER_CATEGORIES: Array<{ id: ReminderCategory; label: string; description: string; tone: "warning" | "danger" | "info" | "neutral" }> = [
  { id: "today", label: "Expire aujourd'hui", description: "L'abonnement se termine aujourd'hui.", tone: "danger" },
  { id: "soon3", label: "Dans 3 jours", description: "Expire dans 1 à 3 jours.", tone: "warning" },
  { id: "soon7", label: "Dans 7 jours", description: "Expire dans 4 à 7 jours.", tone: "info" },
  { id: "grace", label: "En grâce", description: "Clients en période de grâce.", tone: "warning" },
  { id: "expired", label: "Expirés récents", description: "Expiré depuis 1 à 30 jours.", tone: "danger" },
  { id: "lapsed", label: "Anciens clients", description: "Expiré depuis plus de 30 jours : à reconquérir.", tone: "neutral" },
  { id: "balance", label: "Reste à payer", description: "Factures partiellement payées.", tone: "danger" },
];

export const REMINDER_VARIABLES: Array<{ key: string; label: string }> = [
  { key: "prenom", label: "Prénom" },
  { key: "nom", label: "Nom" },
  { key: "service", label: "Service" },
  { key: "date_fin", label: "Date de fin" },
  { key: "jours", label: "Jours" },
  { key: "prix", label: "Prix" },
  { key: "reste_du", label: "Reste dû" },
  { key: "vendeur", label: "Vendeur" },
];

export const PRESET_TEMPLATES: ReminderTemplate[] = [
  { id: "preset:today-polite", category: "today", name: "Rappel du jour", body: "Bonjour {prenom}, votre abonnement {service} se termine aujourd'hui. Souhaitez-vous le renouveler pour continuer sans coupure ? {vendeur}" },
  { id: "preset:today-price", category: "today", name: "Avec le prix", body: "Bonjour {prenom}, votre abonnement {service} expire aujourd'hui. Le renouvellement est à {prix} FCFA. Je vous le relance dès réception du paiement. {vendeur}" },
  { id: "preset:soon3-polite", category: "soon3", name: "Rappel poli", body: "Bonjour {prenom}, petit rappel : votre abonnement {service} expire dans {jours} jour(s), le {date_fin}. Souhaitez-vous le renouveler ? {vendeur}" },
  { id: "preset:soon3-price", category: "soon3", name: "Avec le prix", body: "Bonjour {prenom}, votre abonnement {service} arrive à échéance le {date_fin}. Pour le renouveler, le montant est de {prix} FCFA (Mobile Money accepté). {vendeur}" },
  { id: "preset:soon3-short", category: "soon3", name: "Court", body: "Salut {prenom}, ton {service} expire le {date_fin}. On renouvelle ? {vendeur}" },
  { id: "preset:soon7-polite", category: "soon7", name: "Rappel anticipé", body: "Bonjour {prenom}, votre abonnement {service} expire le {date_fin}, dans {jours} jours. Vous pouvez déjà le renouveler pour être tranquille. {vendeur}" },
  { id: "preset:soon7-price", category: "soon7", name: "Avec le prix", body: "Bonjour {prenom}, votre {service} se termine le {date_fin}. Renouvellement : {prix} FCFA. Dites-moi si je vous le prolonge. {vendeur}" },
  { id: "preset:grace-polite", category: "grace", name: "Rappel de grâce", body: "Bonjour {prenom}, votre abonnement {service} est en période de grâce. Merci de régler {prix} FCFA rapidement pour garder votre profil. {vendeur}" },
  { id: "preset:grace-firm", category: "grace", name: "Dernier délai", body: "Bonjour {prenom}, la période de grâce de votre {service} se termine bientôt. Sans paiement, votre profil sera libéré. Montant : {prix} FCFA. {vendeur}" },
  { id: "preset:expired-polite", category: "expired", name: "Relance douce", body: "Bonjour {prenom}, votre abonnement {service} a expiré il y a {jours} jour(s). Souhaitez-vous le réactiver ? {vendeur}" },
  { id: "preset:expired-price", category: "expired", name: "Avec le prix", body: "Bonjour {prenom}, votre {service} est expiré depuis le {date_fin}. Pour le réactiver : {prix} FCFA. Je peux vous le remettre aujourd'hui. {vendeur}" },
  { id: "preset:expired-firm", category: "expired", name: "Relance ferme", body: "Bonjour {prenom}, sans nouvelle de votre part, votre profil {service} sera attribué à un autre client. Répondez-moi pour le garder. {vendeur}" },
  { id: "preset:lapsed-winback", category: "lapsed", name: "Reconquête", body: "Bonjour {prenom}, ça fait un moment ! Votre abonnement {service} vous manque ? J'ai des profils disponibles, je peux vous le réactiver rapidement. {vendeur}" },
  { id: "preset:lapsed-offer", category: "lapsed", name: "Offre de retour", body: "Bonjour {prenom}, je reprends contact : {service} est toujours disponible à {prix} FCFA par mois. Intéressé(e) ? {vendeur}" },
  { id: "preset:balance-polite", category: "balance", name: "Solde à régler", body: "Bonjour {prenom}, il reste {reste_du} FCFA à régler pour votre abonnement {service}. Merci de compléter le paiement quand vous pouvez. {vendeur}" },
  { id: "preset:balance-firm", category: "balance", name: "Rappel ferme", body: "Bonjour {prenom}, rappel : votre abonnement {service} n'est pas soldé, reste dû {reste_du} FCFA. Merci de régulariser rapidement. {vendeur}" },
];

function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/** Jours restants (négatif si expiré) entre aujourd'hui et la date de fin. */
export function daysLeft(endDate: string, today: string) {
  return daysBetween(today, endDate);
}

/** Catégorie d'échéance d'un abonnement ; « Reste à payer » se calcule à part, depuis les factures. */
export function reminderCategory(sub: { status: string; end_date: string }, today: string): ReminderCategory | null {
  if (sub.status === "cancelled") return null;
  if (sub.status === "grace") return "grace";
  const days = daysLeft(sub.end_date, today);
  if (sub.status === "expired") return Math.min(days, -1) >= -30 ? "expired" : "lapsed";
  if (days === 0) return "today";
  if (days >= 1 && days <= 3) return "soon3";
  if (days >= 4 && days <= 7) return "soon7";
  if (days <= -1 && days >= -30) return "expired";
  if (days < -30) return "lapsed";
  return null;
}

export function renderReminder(body: string, vars: Record<string, string>) {
  return body.replace(/\{([a-z_]+)\}/g, (match, key: string) => (key in vars ? vars[key] : match)).replace(/[ \t]+$/gm, "").trim();
}

export function templatesFor(category: ReminderCategory, custom: ReminderTemplate[]) {
  return [
    ...custom.filter((t) => t.category === category),
    ...custom.filter((t) => t.category === "all"),
    ...PRESET_TEMPLATES.filter((t) => t.category === category),
  ];
}

/** Lien wa.me ; un numéro local camerounais à 9 chiffres reçoit l'indicatif 237. */
export function whatsappUrl(phone: string | null | undefined, text: string) {
  let digits = (phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (!digits) return null;
  if (digits.length === 9 && digits.startsWith("6")) digits = `237${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function isTemplateCategory(value: string): value is TemplateCategory {
  return value === "all" || REMINDER_CATEGORIES.some((c) => c.id === value);
}
