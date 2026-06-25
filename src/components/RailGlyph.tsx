type RailMeta = { bg: string; fg: string; short: string };

const RAILS: Record<string, RailMeta> = {
  "MTN MoMo":     { bg: "#FFCC00", fg: "#0B0D10", short: "MTN" },
  "Orange Money": { bg: "#FF7900", fg: "#FFFFFF", short: "OM"  },
  "Wave":         { bg: "#1AB0F2", fg: "#0B0D10", short: "W"   },
  "Visa":         { bg: "#1A1F71", fg: "#FFFFFF", short: "V"   },
  "Mastercard":   { bg: "#EB001B", fg: "#FFFFFF", short: "MC"  },
  "Cash":         { bg: "#2A2D34", fg: "#F4F5F7", short: "CSH" },
};

export const RAIL_NAMES = Object.keys(RAILS);

type Props = { rail?: string | null; size?: number };

export function RailGlyph({ rail, size = 18 }: Props) {
  const meta = (rail && RAILS[rail]) || RAILS["Cash"];
  return (
    <span
      title={rail ?? "—"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: size + 8,
        height: size,
        borderRadius: 4,
        padding: "0 5px",
        background: meta.bg,
        color: meta.fg,
        font: `700 ${Math.max(8, size * 0.5)}px/1 var(--font-geist-sans)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
        flex: "0 0 auto",
      }}
    >
      {meta.short}
    </span>
  );
}

export function getRailMeta(rail?: string | null): RailMeta {
  return (rail && RAILS[rail]) || RAILS["Cash"];
}
