export type BotPlatform = "whatsapp" | "telegram";

export function parseBotPlatform(value?: string | null): BotPlatform {
  return value === "telegram" ? "telegram" : "whatsapp";
}

export function isTelegramBot(bot: { platform?: BotPlatform }): boolean {
  return bot.platform === "telegram";
}

export function isWhatsAppBot(bot: { platform?: BotPlatform }): boolean {
  return bot.platform !== "telegram";
}
