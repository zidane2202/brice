"use client";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

type Props = {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  tone?: Tone;
};

const TONE_COLOR: Record<Tone, string> = {
  neutral: "var(--sr-fg-subtle)",
  success: "var(--sr-success)",
  warning: "var(--sr-warning)",
  danger:  "var(--sr-danger)",
  info:    "var(--sr-info)",
};
const TONE_BG: Record<Tone, string> = {
  neutral: "var(--sr-surface-3)",
  success: "var(--sr-success-bg)",
  warning: "var(--sr-warning-bg)",
  danger:  "var(--sr-danger-bg)",
  info:    "var(--sr-info-bg)",
};
const TONE_BORDER: Record<Tone, string> = {
  neutral: "transparent",
  success: "var(--sr-success-border)",
  warning: "var(--sr-warning-border)",
  danger:  "var(--sr-danger-border)",
  info:    "var(--sr-info-border)",
};

export function FilterPill({ label, count, active, onClick, tone = "neutral" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "0 10px",
        height: 28,
        minHeight: 28,
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        background: active ? "var(--sr-surface-2)" : "transparent",
        border: "1px solid " + (active ? "var(--sr-border)" : "transparent"),
        borderRadius: 6,
        color: active ? "var(--sr-fg)" : "var(--sr-fg-muted)",
        font: "500 12px/1 var(--font-geist-sans)",
        cursor: "pointer",
        transition: "all var(--sr-dur-fast) var(--sr-ease)",
        boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.04)" : "none",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {typeof count === "number" && (
        <span
          style={{
            font: "500 10px/1 var(--font-geist-mono)",
            color: active && tone !== "neutral" ? TONE_COLOR[tone] : "var(--sr-fg-subtle)",
            padding: "3px 5px",
            background: active && tone !== "neutral" ? TONE_BG[tone] : TONE_BG.neutral,
            border: active && tone !== "neutral" ? `1px solid ${TONE_BORDER[tone]}` : "1px solid transparent",
            borderRadius: 3,
            fontVariantNumeric: "tabular-nums",
            minWidth: 18,
            textAlign: "center",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

type SegmentedProps<T extends string> = {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 3,
        background: "var(--sr-surface)",
        border: "1px solid var(--sr-border-subtle)",
        borderRadius: 6,
        gap: 2,
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          style={{
            height: 24,
            minHeight: 24,
            padding: "0 10px",
            background: value === opt.id ? "var(--sr-surface-2)" : "transparent",
            border: "1px solid " + (value === opt.id ? "var(--sr-border)" : "transparent"),
            borderRadius: 4,
            color: value === opt.id ? "var(--sr-fg)" : "var(--sr-fg-muted)",
            font: "500 11px/1 var(--font-geist-sans)",
            cursor: "pointer",
            transition: "all var(--sr-dur-fast) var(--sr-ease)",
            boxShadow: "none",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
