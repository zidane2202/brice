import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { activeSellerOrResponse } from "@/lib/api-auth";
import { extractImportFile } from "@/lib/import-files";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";

const MAX_FILES = 5;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_HISTORY = 10;
const MODEL = process.env.ANTHROPIC_IMPORT_MODEL || "claude-sonnet-4-5";

type HistoryMessage = { role: "user" | "assistant"; content: string };

export type ImportAssistantConfig = {
  toolName: string;
  toolDescription: string;
  columns: readonly string[];
  columnHelp: Record<string, string>;
  systemPrompt: (userId: string) => Promise<string>;
  normalize: (row: Record<string, unknown>) => Record<string, string>;
  keep: (row: Record<string, string>) => boolean;
  maxRows: number;
  emptyInputError: string;
  foundReply: (count: number) => string;
  truncatedReply: string;
  logTag: string;
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

/** Convertit une liste libre (texte, image, PDF, bureautique) en lignes d'import via un appel d'outil forcé. */
export async function runImportAssistant(request: Request, config: ImportAssistantConfig) {
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
    return NextResponse.json({ error: config.emptyInputError }, { status: 400 });
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

  const tool: Anthropic.Tool = {
    name: config.toolName,
    description: config.toolDescription,
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Réponse courte au vendeur, en français." },
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: Object.fromEntries(config.columns.map((column) => [column, { type: "string", description: config.columnHelp[column] }])),
            additionalProperties: false,
          },
        },
      },
      required: ["message", "rows"],
    },
  };

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16_000,
      system: await config.systemPrompt(user.id),
      tools: [tool],
      tool_choice: { type: "tool", name: config.toolName },
      messages,
    });

    const call = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
    const input = (call?.input ?? {}) as { message?: unknown; rows?: unknown };
    const rows = (Array.isArray(input.rows) ? input.rows : [])
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
      .map(config.normalize)
      .filter(config.keep)
      .slice(0, config.maxRows);
    let reply = typeof input.message === "string" && input.message.trim() ? input.message.trim() : config.foundReply(rows.length);
    if (response.stop_reason === "max_tokens") reply += ` ${config.truncatedReply}`;
    if (refused.length) reply += ` Fichier(s) ignoré(s) : ${refused.join(" ; ")}.`;

    return NextResponse.json({ reply, rows });
  } catch (err) {
    console.error(`[${config.logTag}]`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "L'assistant a rencontré une erreur. Réessayez dans quelques instants." }, { status: 502 });
  }
}
