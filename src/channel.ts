/** Canal deste deploy — painel e runtime são WhatsApp. */
export const APP_CHANNEL = "whatsapp" as const;

export function isWhatsAppChannel() {
  return APP_CHANNEL === "whatsapp";
}
