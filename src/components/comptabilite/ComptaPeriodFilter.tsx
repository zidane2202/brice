"use client";

type Props = {
  year: number;
  month: number;
};

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export function ComptaPeriodFilter({ year, month }: Props) {
  const years = [year - 1, year, year + 1];

  return (
    <form method="get" action="/comptabilite" className="fields two-cols" style={{ margin: 0, maxWidth: 360 }}>
      <label>
        Mois
        <select name="month" defaultValue={month}>
          {MONTHS.map((label, i) => (
            <option key={label} value={i + 1}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Année
        <select name="year" defaultValue={year}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" style={{ alignSelf: "end" }}>
        Afficher
      </button>
    </form>
  );
}
