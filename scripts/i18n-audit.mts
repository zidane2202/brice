// Liste les textes français visibles qui ne sont pas couverts par le dictionnaire EN.
// Usage : node --experimental-strip-types scripts/i18n-audit.mts [--json]
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { UI_EN, UI_EN_EXTRA } from "../src/i18n/ui-dictionary.ts";
import { UI_EN_APP } from "../src/i18n/ui-dictionary-app.ts";
import { createUiTranslator, normalizeUiKey } from "../src/lib/ui-translate.ts";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(ROOT, "src");
const translate = createUiTranslator([UI_EN_APP, UI_EN_EXTRA, UI_EN]);

const SKIP_DIRS = new Set(["i18n", "node_modules"]);
const TECH_ATTRS = new Set([
  "className", "style", "href", "src", "type", "name", "id", "key", "role", "method", "rel", "target",
  "inputMode", "autoComplete", "htmlFor", "viewBox", "fill", "stroke", "d", "action", "encType", "accept",
  "value", "defaultValue", "tone", "variant", "size", "icon", "as", "lang", "dir", "pattern", "step",
  "min", "max", "form", "sizes", "media", "crossOrigin", "referrerPolicy", "loading", "decoding", "color",
]);
const FRENCH_WORDS = /\b(le|la|les|des|du|de|un|une|et|pour|avec|sans|aucun|aucune|votre|vos|mois|jour|jours|client|clients|compte|comptes|profil|profils|abonnement|abonnements|facture|factures|paiement|annuler|enregistrer|ajouter|supprimer|modifier|réservé|impossible|introuvable|invalide|requis|obligatoire|est|sont|pas|plus|vers|sur|dans|ce|cette|ces|au|aux|ou|par|en)\b/i;
const ACCENT = /[àâäéèêëïîôöùûüÿçœæÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇŒÆ’]/;

type Hit = { text: string; file: string; line: number; kind: string };
const hits: Hit[] = [];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) out.push(...walk(full));
    } else if (/\.(tsx|ts)$/.test(entry) && !/\.test\.ts$/.test(entry) && !/\.d\.ts$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function looksFrench(text: string) {
  const t = normalizeUiKey(text);
  if (!t || !/\p{L}/u.test(t)) return false;
  if (/^[a-z0-9_.:/#-]+$/i.test(t) && !ACCENT.test(t)) return false;
  if (/^(https?:|\/|var\(|#|rgba?\(|[a-z]+\/[a-z]+)/i.test(t)) return false;
  if (/var\(--|\bpx\b|^use (client|server)$|\{n\}:\/\/|\/facture\/|\.csv$|@example\.com|@email\.com/.test(t)) return false;
  return ACCENT.test(t) || FRENCH_WORDS.test(t);
}

// Volontairement en français : messages WhatsApp envoyés aux clients finaux, noms propres, config serveur.
const INTENTIONAL = /^(Bonjour\b|Yaoundé$|PROVIDER_CREDENTIALS_KEY\b|a expiré il y a|expire dans \d+ jour)/;

function covered(text: string) {
  const t = normalizeUiKey(text).replace(/\{n\}/g, "7");
  return INTENTIONAL.test(t) || translate(t) !== t;
}

function templateText(node: ts.TemplateExpression) {
  let text = node.head.text;
  for (const span of node.templateSpans) text += "{n}" + span.literal.text;
  return text;
}

function record(sf: ts.SourceFile, node: ts.Node, raw: string, kind: string) {
  const parts = raw.split(/\{n\}/).map((p) => p.trim()).filter(Boolean);
  if (raw.includes("{n}") && covered(raw)) return;
  const candidates = raw.includes("{n}") ? [raw, ...parts] : [raw];
  for (const text of candidates) {
    if (!looksFrench(text)) continue;
    if (covered(text)) continue;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    hits.push({ text: normalizeUiKey(text), file: relative(ROOT, sf.fileName).replace(/\\/g, "/"), line: line + 1, kind });
    return;
  }
}

function isUserFacingCall(node: ts.Node): string | null {
  let current: ts.Node | undefined = node.parent;
  while (current && (ts.isBinaryExpression(current) || ts.isConditionalExpression(current) || ts.isParenthesizedExpression(current))) {
    current = current.parent;
  }
  if (!current) return null;
  if (ts.isNewExpression(current) && current.expression.getText() === "Error") return "error";
  if (ts.isCallExpression(current)) {
    const callee = current.expression.getText();
    if (/toast\.(success|error|loading|info|warning)|planLimitError|setMessage|setError|setActionError|alert|confirm/.test(callee)) return "call";
    if (/NextResponse\.json/.test(callee)) return "api";
  }
  return null;
}

function scan(file: string) {
  const source = readFileSync(file, "utf8");
  const isTsx = file.endsWith(".tsx");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText(sf).replace(/&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
      if (text.trim()) record(sf, node, text, "jsx");
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(sf);
      if (!TECH_ATTRS.has(name) && !name.startsWith("data-")) record(sf, node, node.initializer.text, `attr:${name}`);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isLiteralTypeNode(parent)) return;
      if (ts.isJsxAttribute(parent)) return;
      if (ts.isPropertyAssignment(parent) && parent.name === node) return;
      if (ts.isElementAccessExpression(parent)) return;
      if (ts.isCallExpression(parent) && /^(from|select|eq|neq|in|order|rpc|insert|update|upsert|delete|is|not|gte|lte|gt|lt|ilike|like|or|get|getAll|set|has|delete|includes|startsWith|endsWith|split|replace|match|test|revalidatePath|redirect|require|fetch|setAttribute|getAttribute|querySelector|addEventListener|removeEventListener|getItem|setItem|removeItem|append|padStart|toLocaleString|toLocaleDateString)$/.test(parent.expression.getText(sf).split(".").pop() ?? "")) return;
      const labelProp =
        ts.isPropertyAssignment(parent) && /^(label|title|body|description|message|hint|text|sub|short)$/.test(parent.name.getText(sf));
      const kind = isUserFacingCall(node) ?? (isTsx ? "tsx-literal" : labelProp ? "ts-label" : null);
      if (kind) record(sf, node, node.text, kind);
    } else if (ts.isTemplateExpression(node)) {
      const kind = isUserFacingCall(node) ?? (isTsx ? "tsx-template" : null);
      if (kind) record(sf, node, templateText(node), kind);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

for (const file of walk(SRC)) scan(file);

const unique = new Map<string, Hit[]>();
for (const hit of hits) {
  const list = unique.get(hit.text) ?? [];
  list.push(hit);
  unique.set(hit.text, list);
}

const outIndex = process.argv.indexOf("--out");
if (outIndex > -1) {
  writeFileSync(process.argv[outIndex + 1], JSON.stringify([...unique.keys()].sort(), null, 2), "utf8");
  console.log(`${unique.size} textes écrits dans ${process.argv[outIndex + 1]}`);
} else if (process.argv.includes("--json")) {
  console.log(JSON.stringify([...unique.keys()].sort(), null, 2));
} else {
  const byFile = new Map<string, Set<string>>();
  for (const [text, list] of unique) {
    for (const hit of list) {
      const set = byFile.get(hit.file) ?? new Set();
      set.add(text);
      byFile.set(hit.file, set);
    }
  }
  for (const [file, texts] of [...byFile].sort()) {
    console.log(`\n${file} (${texts.size})`);
    for (const text of texts) console.log(`  - ${text}`);
  }
  console.log(`\n${unique.size} textes uniques non traduits dans ${byFile.size} fichiers.`);
}
process.exitCode = unique.size ? 1 : 0;
