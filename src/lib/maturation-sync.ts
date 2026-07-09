import { getBotByIdAny, loadBots, upsertBot } from "../bots.js";
import { listActiveWarmSessions } from "./chip-warmer.js";
import { setBotChipWarmingMode } from "../whatsapp-runtime.js";

export async function getActiveMaturationBotIds(): Promise<Set<string>> {
  const sessions = await listActiveWarmSessions();
  return new Set(sessions.flatMap((s) => s.botIds));
}

/** Pausa IA nas instâncias em maturação ativa; libera quando sessão encerra. */
export async function syncMaturationModeForBot(botId: string, active: boolean) {
  await setBotChipWarmingMode(botId, active);
  const bot = await getBotByIdAny(botId);
  if (!bot) return;
  if (active && bot.active) {
    await upsertBot({ ...bot, active: false });
  }
}

export async function syncMaturationModeForBots(botIds: string[], active: boolean) {
  for (const botId of botIds) {
    await syncMaturationModeForBot(botId, active);
  }
}

export async function syncAllMaturationModes() {
  const warming = await getActiveMaturationBotIds();
  const bots = await loadBots();
  await Promise.all(
    bots.map(async (bot) => {
      await setBotChipWarmingMode(bot.id, warming.has(bot.id));
    })
  );
}
