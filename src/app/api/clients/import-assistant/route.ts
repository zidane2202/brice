import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { activeSellerOrResponse } from "@/lib/api-auth";
import { hasIdentity, IMPORT_COLUMNS, IMPORT_MAX_ROWS, normalizeImportRow } from "@/lib/client-import";
import { todayDateOnly } from "@/lib/dates";
import { extractImportFile } from "@/lib/import-files";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILES = 5;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_HISTORY = 10;
const MODEL = process.env.ANTHROPIC_IMPORT_MODEL || "claude-sonnet-4-5";
const TOOL_NAME = "client_import_csv";

type HistoryMessage = { role: "user" | "assistant"; content: string };

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

function systemPrompt(catalog: string) {
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
${catalog}`;
}

const tool: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "Renvoie la liste des clients extraits, au format d'import de la plateforme.",
  input_schema: {
    type: "object",
    properties: {
      message: { type: "string", description: "Réponse courte au vendeur, en français." },
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: Object.fromEntries(IMPORT_COLUMNS.map((column) => [column, { type: "string", description: COLUMN_HELP[column] }])),
          additionalProperties: false,
        },
      },
    },
    required: ["message", "rows"],
  },
};

function parseHistory(raw: FormDataEntryValue | null): HistoryMessage[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is HistoryMessage => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim().length > 0)
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 16_000) }));
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const authz = await activeSellerOrResponse();
  if (!authz.ok) return authz.response;
  const user = authz.user;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "L'assistant d'import est temporairement indisponible." }, { status: 503 });
  }
  if (!await consumeRateLimit(`${user.id}:${requestIp(request)}`, "import-assistant", 20, 3600)) {
    return NextResponse.json({ error: "Trop de demandes. Réessayez dans une heure." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const text = String(form.get("message") ?? "").trim().slice(0, 20_000);
  const files = form.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
  if (!text && files.length === 0) {
    return NextResponse.json({ error: "Envoyez une liste de clients : texte ou fichier." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} fichiers par message.` }, { status: 400 });
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Fichiers trop lourds (4 Mo maximum au total)." }, { status: 400 });
  }

  const content: Anthropic.ContentBlockParam[] = [];
  const refused: string[] = [];
  for (const file of files) {
    const extracted = extractImportFile(file.name, file.type, new Uint8Array(await file.arrayBuffer()));
    if (extracted.kind === "image") {
      content.push({ type: "text", text: `Fichier image : ${file.name}` });
      content.push({ type: "image", source: { type: "base64", media_type: extracted.mediaType, data: extracted.base64 } });
    } else if (extracted.kind === "pdf") {
      content.push({ type: "document", title: file.name, source: { type: "base64", media_type: "application/pdf", data: extracted.base64 } });
    } else if (extracted.kind === "text") {
      content.push({ type: "text", text: `Contenu du fichier ${file.name} :\n${extracted.text}` });
    } else {
      refused.push(`${file.name} (${extracted.reason})`);
    }
  }
  if (text) content.push({ type: "text", text });
  if (content.length === 0) {
    return NextResponse.json({ error: `Aucun fichier lisible : ${refused.join(" ; ")}.` }, { status: 400 });
  }

  const messages: Anthropic.MessageParam[] = [];
  for (const message of parseHistory(form.get("history"))) {
    const last = messages[messages.length - 1];
    if (!last && message.role === "assistant") continue;
    if (last?.role === message.role) last.content = `${last.content as string}\n\n${message.content}`;
    else messages.push({ role: message.role, content: message.content });
  }
  if (messages[messages.length - 1]?.role === "user") messages.pop();
  messages.push({ role: "user", content });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16_000,
      system: systemPrompt(await sellerCatalog(user.id)),
      tools: [tool],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages,
    });

    const call = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
    const input = (call?.input ?? {}) as { message?: unknown; rows?: unknown };
    const rows = (Array.isArray(input.rows) ? input.rows : [])
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
      .map(normalizeImportRow)
      .filter(hasIdentity)
      .slice(0, IMPORT_MAX_ROWS);
    let reply = typeof input.message === "string" && input.message.trim() ? input.message.trim() : `${rows.length} client(s) trouvé(s).`;
    if (response.stop_reason === "max_tokens") reply += " La liste était trop longue : seuls les premiers clients ont été extraits.";
    if (refused.length) reply += ` Fichier(s) ignoré(s) : ${refused.join(" ; ")}.`;

    return NextResponse.json({ reply, rows });
  } catch (err) {
    console.error("[import-assistant]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "L'assistant a rencontré une erreur. Réessayez dans quelques instants." }, { status: 502 });
  }
}
