/** Canal deste deploy — WhatsApp + Telegram (conta real MTProto). */
export const APP_CHANNEL = "multi" as const;

export function isWhatsAppChannel() {
  return true;
}

export function supportsTelegram() {
  return true;
}
