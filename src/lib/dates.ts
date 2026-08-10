const DAY = 24 * 60 * 60 * 1000;
export const APP_TIMEZONE = "Africa/Lagos";

export function civilDateInZone(date = new Date(), timeZone = APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function toDateInputValue(date = new Date()) {
  return civilDateInZone(date);
}

export function todayDateOnly(now = new Date()) {
  return civilDateInZone(now);
}

export function firstOfMonthDateOnly(now = new Date(), monthsAgo = 0) {
  const [year, month] = civilDateInZone(now).split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1 - monthsAgo, 1));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

export function addMonths(dateStr: string, months: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toDateInputValue(date);
}

export function daysUntil(dateValue: string) {
  const today = todayDateOnly();
  const target = dateValue.length > 10 ? dateValue.slice(0, 10) : dateValue;
  const start = new Date(`${today}T00:00:00Z`).getTime();
  const end = new Date(`${target}T00:00:00Z`).getTime();
  return Math.round((end - start) / DAY);
}

export function formatDate(dateValue: string) {
  const dateOnly = dateValue.length > 10 ? dateValue.slice(0, 10) : dateValue;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateOnly}T00:00:00`));
}

export function reminderLabel(endDate: string) {
  const days = daysUntil(endDate);

  if (days < 0) {
    return `Expire depuis ${Math.abs(days)} j`;
  }

  if (days === 0) {
    return "Expire aujourd'hui";
  }

  return `Expire dans ${days} j`;
}
