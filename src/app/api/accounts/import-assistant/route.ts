import { ACCOUNT_IMPORT_COLUMNS, ACCOUNT_IMPORT_MAX_ROWS, normalizeAccountRow } from "@/lib/account-import";
import { todayDateOnly } from "@/lib/dates";
import { runImportAssistant } from "@/lib/import-assistant";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

const TOOL_NAME = "account_import_csv";

const COLUMN_HELP: Record<(typeof ACCOUNT_IMPORT_COLUMNS)[number], string> = {
  service_name: "nom du service (Netflix, Spotify, Prime Video, DStv, Canal+…), avec la casse usuelle",
  label: "libellé libre pour distinguer plusieurs comptes du même service",
  account_email: "e-mail ou identifiant de connexion du compte",
  account_password: "mot de passe du compte, recopié à l'identique",
  max_slots: "nombre de profils ou places vendables sur ce compte (nombre entier)",
  start_date: "date de début ou d'achat au format AAAA-MM-JJ",
  end_date: "date d'échéance ou d'expiration au format AAAA-MM-JJ",
  duration_months: "durée de l'abonnement en mois (nombre entier de 1 à 24)",
  cost: "prix payé au fournisseur en FCFA (nombre entier, sans espace ni devise)",
};

async function existingAccounts(userId: string) {
  const { data } = await createSupabaseAdmin()
    .from("provider_accounts")
    .select("service_name, label, account_email")
    .eq("user_id", userId)
    .limit(200);
  if (!data?.length) return "Aucun compte enregistré pour l'instant.";
  return data.map((a) => `- ${a.service_name}${a.label ? ` (${a.label})` : ""}${a.account_email ? ` : ${a.account_email}` : ""}`).join("\n");
}

async function systemPrompt(userId: string) {
  return `Tu es l'assistant d'import de SubResell, une application de revente d'abonnements. Le vendeur t'envoie la liste de ses comptes fournisseurs (Netflix, Spotify, DStv…) sous n'importe quelle forme (texte libre, tableau, capture d'écran, PDF, Excel, Word). Ton travail : extraire chaque compte et appeler l'outil ${TOOL_NAME} avec une ligne par compte.

Colonnes possibles (seul service_name est indispensable) :
${ACCOUNT_IMPORT_COLUMNS.map((column) => `- ${column} : ${COLUMN_HELP[column]}`).join("\n")}

Règles :
- N'invente jamais une information. Si un champ n'apparaît pas, laisse-le absent.
- Ignore les lignes de titre, totaux ou décoration.
- Les dates sans année sont de l'année en cours. Aujourd'hui : ${todayDateOnly()}.
- Maximum ${ACCOUNT_IMPORT_MAX_ROWS} comptes. S'il y en a plus, garde les ${ACCOUNT_IMPORT_MAX_ROWS} premiers et dis-le.
- Si le vendeur demande une correction, renvoie la liste complète corrigée.
- Dans "message", réponds en français, en 1 à 3 phrases : combien de comptes trouvés, quels champs manquent (souvent le nombre de profils ou l'échéance), ce qu'il faut vérifier. Signale les comptes qui semblent déjà enregistrés (liste ci-dessous).

Comptes déjà enregistrés :
${await existingAccounts(userId)}`;
}

export async function POST(request: Request) {
  return runImportAssistant(request, {
    toolName: TOOL_NAME,
    toolDescription: "Renvoie la liste des comptes fournisseurs extraits, au format d'import de la plateforme.",
    columns: ACCOUNT_IMPORT_COLUMNS,
    columnHelp: COLUMN_HELP,
    systemPrompt,
    normalize: (row) => normalizeAccountRow(row) as Record<string, string>,
    keep: (row) => Boolean(row.service_name),
    maxRows: ACCOUNT_IMPORT_MAX_ROWS,
    emptyInputError: "Envoyez une liste de comptes : texte ou fichier.",
    foundReply: (count) => `${count} compte(s) trouvé(s).`,
    truncatedReply: "La liste était trop longue : seuls les premiers comptes ont été extraits.",
    logTag: "account-import-assistant",
  });
}
