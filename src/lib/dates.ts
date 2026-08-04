const DAY = 24 * 60 * 60 * 1000;

export function toDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

export function addMonths(dateStr: string, months: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return toDateInputValue(date);
}

export function daysUntil(dateValue: string) {
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const target = new Date(`${dateValue}T00:00:00`);
  return Math.ceil((target.getTime() - startOfToday.getTime()) / DAY);
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
