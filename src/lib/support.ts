function waNumber() {
  return (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "").replace(/\D/g, "");
}

export function supportWhatsAppHref(text: string) {
  const q = encodeURIComponent(text);
  const n = waNumber();
  return n ? `https://wa.me/${n}?text=${q}` : `https://wa.me/?text=${q}`;
}
