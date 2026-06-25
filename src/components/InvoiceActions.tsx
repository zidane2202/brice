"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import type { Invoice } from "@/lib/types";

function digitsOnly(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const handlePrint = () => window.print();
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}${window.location.pathname}`);
  }, []);

  const text = `Bonjour ${invoice.client_name}, voici ta facture pour ${invoice.service_name} (${invoice.amount.toLocaleString("en-US").replace(/,/g, " ")} FCFA). Lien : ${url}`;
  const waNumber = invoice.client_phone ? digitsOnly(invoice.client_phone) : "";
  const waHref = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <div className="invoice-actions">
      <button type="button" onClick={handlePrint} className="invoice-action invoice-action-primary">
        <Icon name="download" size={14} />
        Télécharger PDF
      </button>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="invoice-action invoice-action-secondary"
      >
        <Icon name="send" size={14} />
        Envoyer via WhatsApp
      </a>
    </div>
  );
}
