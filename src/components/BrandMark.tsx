"use client";

import { useState } from "react";

type Props = { logoUrl?: string | null; name?: string; size?: number };

export function BrandMark({ logoUrl, name = "subresell", size = 24 }: Props) {
  const [broken, setBroken] = useState(false);
  if (logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        onError={() => setBroken(true)}
        style={{ width: size, height: size, borderRadius: 5, objectFit: "cover" }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 5,
        background: "linear-gradient(135deg, var(--sr-mint-500), var(--sr-mint-700))",
        color: "var(--sr-mint-ink)",
        font: `700 ${Math.round(size * 0.5)}px/1 var(--font-geist-sans)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
      }}
    >
      S
    </span>
  );
}
