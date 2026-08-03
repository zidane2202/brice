"use client";

export function PrintButton() {
  return (
    <button type="button" className="print-hide" onClick={() => window.print()}>
      Imprimer / PDF
    </button>
  );
}
