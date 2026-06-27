export type BotPlatform = "whatsapp";

export function parseBotPlatform(_value?: string | null): BotPlatform {
  return "whatsapp";
}

export function isWhatsAppBot(_bot: { platform?: BotPlatform }): boolean {
  return true;
}
