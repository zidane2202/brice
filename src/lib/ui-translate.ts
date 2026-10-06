export type UiDictionary = Record<string, string>;
export type UiPattern = [RegExp, string];

const NUMBER = /\d(?:[\d\u00A0\u202F .,]*\d)?/g;
const EDGE_PUNCT = /^([\s·,:;()[\]\-–—•|/+]*)([\s\S]*?)([\s·,:;.!?()[\]\-–—•|/…+]*)$/u;

/** Apostrophes, espaces insécables et points de suspension n'empêchent plus la correspondance. */
export function normalizeUiKey(value: string) {
  return value
    .replace(/[’‘ʼ`]/g, "'")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

function matchCase(source: string, target: string) {
  const first = source.charAt(0);
  if (!target) return target;
  if (!first || first.toUpperCase() === first.toLowerCase()) return target;
  if (first === first.toUpperCase()) return target.charAt(0).toUpperCase() + target.slice(1);
  const second = target.charAt(1);
  if (second && second === second.toUpperCase() && second !== second.toLowerCase()) return target;
  return target.charAt(0).toLowerCase() + target.slice(1);
}

const MONTHS: Array<[string, string, string]> = [
  ["janv.", "janvier", "January"], ["févr.", "février", "February"], ["mars", "mars", "March"],
  ["avr.", "avril", "April"], ["mai", "mai", "May"], ["juin", "juin", "June"],
  ["juil.", "juillet", "July"], ["août", "août", "August"], ["sept.", "septembre", "September"],
  ["oct.", "octobre", "October"], ["nov.", "novembre", "November"], ["déc.", "décembre", "December"],
];
const MONTH_EN = new Map<string, string>();
for (const [short, long, en] of MONTHS) {
  MONTH_EN.set(short, en.slice(0, 3));
  MONTH_EN.set(long, en);
}
const MONTH_ALT = [...MONTH_EN.keys()].sort((a, b) => b.length - a.length).map((m) => m.replace(".", "\\.")).join("|");
const FR_DATE = new RegExp(`(^|[^\\p{L}])(\\d{1,2}[\\s\\u00A0\\u202F]+)?(${MONTH_ALT})(?=[\\s\\u00A0\\u202F]+\\d{4})`, "gu");

/** « 05 oct. 2026 » → « 05 Oct 2026 », « octobre 2026 » → « October 2026 ». */
export function localizeFrenchDates(value: string) {
  if (!/\d{4}/.test(value)) return value;
  return value.replace(FR_DATE, (_, before: string, day: string | undefined, month: string) =>
    `${before}${day ?? ""}${MONTH_EN.get(month) ?? month}`
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `{n}` = nombre, `{x}` = texte libre (nom, pluriel…), restitués dans le même ordre. */
function compileTemplate(key: string) {
  const source = escapeRegExp(key)
    .replace(/\\\{n\\\}/g, "(\\d(?:[\\d\\u00A0\\u202F .,]*\\d)?)")
    .replace(/\\\{x\\\}/g, "(.*?)");
  return new RegExp(`^${source}$`, "su");
}

export function createUiTranslator(dictionaries: UiDictionary[], patterns: UiPattern[] = []) {
  const exact = new Map<string, string>();
  const folded = new Map<string, string>();
  const templates: Array<{ regex: RegExp; value: string }> = [];
  for (const dictionary of dictionaries) {
    for (const [key, value] of Object.entries(dictionary)) {
      const normalized = normalizeUiKey(key);
      if (!exact.has(normalized)) exact.set(normalized, value);
      const lower = normalized.toLowerCase();
      if (!folded.has(lower)) folded.set(lower, value);
      if (normalized.includes("{x}") || normalized.includes("{n}")) {
        templates.push({ regex: compileTemplate(normalized), value });
      }
    }
  }

  function lookup(core: string): string | undefined {
    const key = normalizeUiKey(core);
    if (!key) return undefined;
    const direct = exact.get(key);
    if (direct !== undefined) return direct;

    const numbers: string[] = [];
    const template = key.replace(NUMBER, (match) => {
      numbers.push(match);
      return "{n}";
    });
    if (numbers.length) {
      const hit = exact.get(template) ?? folded.get(template.toLowerCase());
      if (hit !== undefined) {
        let index = 0;
        return hit.replace(/\{[nx]\}/g, () => numbers[index++] ?? "");
      }
    }

    const insensitive = folded.get(key.toLowerCase());
    if (insensitive !== undefined) return matchCase(key, insensitive);

    for (const { regex, value } of templates) {
      const match = key.match(regex);
      if (!match) continue;
      let index = 1;
      return value.replace(/\{[nx]\}/g, () => match[index++] ?? "");
    }
    return undefined;
  }

  return function translate(value: string): string {
    const lead = value.match(/^\s*/)?.[0] ?? "";
    const tail = value.match(/\s*$/)?.[0] ?? "";
    const core = value.trim();
    if (!core || !/\p{L}/u.test(core)) return value;

    let next = lookup(core);
    if (next === undefined) {
      const parts = core.match(EDGE_PUNCT);
      if (parts && parts[2] && (parts[1] || parts[3])) {
        const inner = lookup(parts[2]);
        if (inner !== undefined) next = parts[1] + inner + parts[3];
      }
    }
    if (next === undefined) {
      next = core;
      for (const [pattern, replacement] of patterns) next = next.replace(pattern, replacement);
    }
    return lead + localizeFrenchDates(next) + tail;
  };
}
