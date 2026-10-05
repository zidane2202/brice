import { strFromU8, unzipSync } from "fflate";

type ImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export type ExtractedFile =
  | { kind: "image"; name: string; mediaType: ImageMediaType; base64: string }
  | { kind: "pdf"; name: string; base64: string }
  | { kind: "text"; name: string; text: string }
  | { kind: "unsupported"; name: string; reason: string };

export const MAX_TEXT_CHARS = 60_000;

const IMAGE_TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" } as const;

function extension(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

function columnIndex(ref: string) {
  const letters = ref.replace(/\d+/g, "");
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function xlsxToText(files: Record<string, Uint8Array>) {
  const shared: string[] = [];
  const sharedXml = files["xl/sharedStrings.xml"] ? strFromU8(files["xl/sharedStrings.xml"]) : "";
  for (const item of sharedXml.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    shared.push(decodeXml((item.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("")));
  }
  const sheets = Object.keys(files).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path)).sort();
  const parts: string[] = [];
  for (const path of sheets) {
    const xml = strFromU8(files[path]);
    const lines: string[] = [];
    for (const rowXml of xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
      const cells: string[] = [];
      for (const cell of rowXml.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
        const ref = cell.match(/r="([A-Z]+\d+)"/)?.[1];
        const type = cell.match(/t="(\w+)"/)?.[1];
        const raw = cell.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? cell.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
        const value = type === "s" ? shared[Number(raw)] ?? "" : decodeXml(raw);
        cells[ref ? columnIndex(ref) : cells.length] = value;
      }
      if (cells.some(Boolean)) lines.push(Array.from(cells, (value) => value ?? "").join("\t"));
    }
    if (lines.length) parts.push(`# ${path.replace(/^.*\//, "")}\n${lines.join("\n")}`);
  }
  return parts.join("\n\n");
}

function xmlToText(xml: string) {
  return decodeXml(
    xml
      .replace(/<\/(w:p|text:p|text:h|a:p|table:table-row|w:tr)>/g, "\n")
      .replace(/<(w:tab|text:tab|table:table-cell)[^>]*\/?>/g, "\t")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \u00A0]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function officeToText(bytes: Uint8Array): string | null {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (file) => file.name.endsWith(".xml") });
  } catch {
    return null;
  }
  if (files["xl/workbook.xml"]) return xlsxToText(files);
  if (files["word/document.xml"]) return xmlToText(strFromU8(files["word/document.xml"]));
  if (files["content.xml"]) return xmlToText(strFromU8(files["content.xml"]));
  const slides = Object.keys(files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort();
  if (slides.length) return slides.map((path) => xmlToText(strFromU8(files[path]))).join("\n\n");
  return null;
}

function looksLikeText(text: string) {
  if (!text) return false;
  const sample = text.slice(0, 4000);
  const bad = (sample.match(/[\u0000-\u0008\u000E-\u001F\uFFFD]/g) ?? []).length;
  return bad / sample.length < 0.02;
}

function decodeText(bytes: Uint8Array) {
  const utf8 = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  if (!utf8.includes("\uFFFD")) return utf8;
  return new TextDecoder("windows-1252").decode(bytes);
}

function truncate(text: string) {
  return text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n[… contenu tronqué]` : text;
}

/** Transforme un fichier envoyé par le vendeur en contenu lisible par le modèle. */
export function extractImportFile(name: string, type: string, bytes: Uint8Array): ExtractedFile {
  const ext = extension(name);
  const imageType = IMAGE_TYPES[ext as keyof typeof IMAGE_TYPES] ?? (Object.values(IMAGE_TYPES) as string[]).find((t) => t === type);
  if (imageType) {
    if (bytes.length > 5 * 1024 * 1024) return { kind: "unsupported", name, reason: "image de plus de 5 Mo" };
    return { kind: "image", name, mediaType: imageType as ImageMediaType, base64: Buffer.from(bytes).toString("base64") };
  }
  if (ext === "pdf" || type === "application/pdf") return { kind: "pdf", name, base64: Buffer.from(bytes).toString("base64") };
  if (["heic", "heif"].includes(ext)) return { kind: "unsupported", name, reason: "format HEIC (iPhone) non lu : envoyez une capture en JPG ou PNG" };
  if (["xls", "doc", "ppt"].includes(ext)) return { kind: "unsupported", name, reason: `ancien format .${ext} : enregistrez-le en .${ext}x ou en PDF` };

  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const text = officeToText(bytes);
    if (text) return { kind: "text", name, text: truncate(text) };
    return { kind: "unsupported", name, reason: "archive non reconnue" };
  }
  const text = decodeText(bytes);
  if (looksLikeText(text)) return { kind: "text", name, text: truncate(text) };
  return { kind: "unsupported", name, reason: "format illisible : envoyez du texte, une image, un PDF, un Excel ou un Word" };
}
