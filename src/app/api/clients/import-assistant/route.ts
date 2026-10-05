import { hasIdentity, IMPORT_COLUMNS, IMPORT_MAX_ROWS, normalizeImportRow } from "@/lib/client-import";
import { todayDateOnly } from "@/lib/dates";
import { runImportAssistant } from "@/lib/import-assistant";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

const TOOL_NAME = "client_import_csv";

const COLUMN_HELP: Record<(typeof IMPORT_COLUMNS)[number], string> = {
  first_name: "prénom (ou nom complet si on ne peut pas séparer)",
  last_name: "nom de famille",
  phone: "téléphone, chiffres uniquement, garder l'indicatif s'il est fourni",
  email: "adresse e-mail",
  service: "nom du service, écrit exactement comme dans la liste des comptes du vendeur",
  profile: "nom du profil, écrit exactement comme dans la liste des comptes du vendeur",
  start_date: "date de début au format AAAA-MM-JJ",
  duration_months: "durée en mois (nombre entier de 1 à 24)",
  price: "montant payé en FCFA (nombre entier, sans espace ni devise)",
  payment_rail: "moyen de paiement (ex. MTN MoMo, Orange Money, Espèces)",
  pin_code: "code PIN du profil",
};

async function sellerCatalog(userId: string) {
  const db = createSupabaseAdmin();
  const { data } = await db
    .from("provider_accounts")
    .select("service_name, status, account_slots(label, slot_number)")
    .eq("user_id", userId)
    .limit(100);
  if (!data?.length) return "Le vendeur n'a encore aucun compte fournisseur : laisse service et profil vides sauf s'ils sont écrits dans la liste.";
  return data
    .map((account) => {
      const slots = ((account.account_slots as unknown as Array<{ label: string | null; slot_number: number }>) ?? [])
        .sort((a, b) => a.slot_number - b.slot_number)
        .map((slot) => slot.label || `Profil ${slot.slot_number}`);
      return `- ${account.service_name}${account.status === "active" ? "" : " (inactif)"} : ${slots.join(", ") || "aucun profil"}`;
    })
    .join("\n");
}

async function systemPrompt(userId: string) {
  return `Tu es l'assistant d'import de SubResell, une application de revente d'abonnements (Netflix, Spotify, DStv…). Le vendeur t'envoie une liste de ses clients sous n'importe quelle forme (texte libre, tableau, capture d'écran, PDF, Excel, Word, contacts). Ton travail : extraire chaque client et appeler l'outil ${TOOL_NAME} avec une ligne par client.

Colonnes possibles (toutes facultatives) :
${IMPORT_COLUMNS.map((column) => `- ${column} : ${COLUMN_HELP[column]}`).join("\n")}

Règles :
- N'invente jamais une information. Si un champ n'apparaît pas, laisse-le absent.
- Une ligne doit au moins contenir un nom, un téléphone ou un e-mail ; ignore les lignes de titre, totaux ou décoration.
- Associe service et profil aux comptes du vendeur ci-dessous quand la correspondance est évidente (ex. « netflix p2 » → « Netflix » / « Profil 2 »). Sinon recopie ce qui est écrit.
- Les dates sans année sont de l'année en cours. Aujourd'hui : ${todayDateOnly()}.
- Maximum ${IMPORT_MAX_ROWS} clients. S'il y en a plus, garde les ${IMPORT_MAX_ROWS} premiers et dis-le.
- Si le vendeur demande une correction, renvoie la liste complète corrigée, pas seulement les lignes modifiées.
- Dans "message", réponds en français, en 1 à 3 phrases : combien de clients trouvés, quels champs manquent souvent, ce qu'il faut vérifier. Si tu ne trouves aucun client, explique pourquoi avec rows vide.

Comptes du vendeur (service : profils) :
${await sellerCatalog(userId)}`;
}

export async function POST(request: Request) {
  return runImportAssistant(request, {
    toolName: TOOL_NAME,
    toolDescription: "Renvoie la liste des clients extraits, au format d'import de la plateforme.",
    columns: IMPORT_COLUMNS,
    columnHelp: COLUMN_HELP,
    systemPrompt,
    normalize: (row) => normalizeImportRow(row) as Record<string, string>,
    keep: hasIdentity,
    maxRows: IMPORT_MAX_ROWS,
    emptyInputError: "Envoyez une liste de clients : texte ou fichier.",
    foundReply: (count) => `${count} client(s) trouvé(s).`,
    truncatedReply: "La liste était trop longue : seuls les premiers clients ont été extraits.",
    logTag: "import-assistant",
  });
}
