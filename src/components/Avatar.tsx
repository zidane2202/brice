const PALETTES: [string, string, string][] = [
  ["#29DC85", "#169A5C", "#001A0C"],
  ["#5CC8FF", "#2A87D6", "#001A2E"],
  ["#FFB547", "#E6911E", "#2E1A00"],
  ["#B388FF", "#7B53D1", "#1A0A2E"],
  ["#FF8FA6", "#D14E73", "#2E0A18"],
];

function paletteFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

type Props = { name?: string; size?: number };

export function Avatar({ name = "??", size = 28 }: Props) {
  const initials = name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const [a, b, ink] = paletteFor(name);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 999,
        background: `linear-gradient(135deg, ${a}, ${b})`,
        color: ink,
        font: `600 ${Math.max(9, size * 0.42)}px/1 var(--font-geist-sans)`,
        flex: "0 0 auto",
      }}
    >
      {initials}
    </span>
  );
}
