export type BotPlatform = "whatsapp" | "telegram";

export function parseBotPlatform(value?: string | null): BotPlatform {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "telegram" || v === "tg") return "telegram";
  return "whatsapp";
}

export function isWhatsAppBot(bot: { platform?: BotPlatform }): boolean {
  return parseBotPlatform(bot.platform) === "whatsapp";
}

export function isTelegramBot(bot: { platform?: BotPlatform }): boolean {
  return parseBotPlatform(bot.platform) === "telegram";
}

export function platformLabel(platform?: BotPlatform | null): string {
  return parseBotPlatform(platform) === "telegram" ? "Telegram" : "WhatsApp";
}
