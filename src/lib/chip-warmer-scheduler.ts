import path from "node:path";
import fs from "node:fs/promises";
import { rootDir } from "../config.js";
import { loadBots } from "../bots.js";
import { saoPauloNowParts } from "../panel/layout.js";
import {
  computeHealthScore,
  effectiveDailyGoal,
  getBotWarmScores,
  listActiveWarmSessions,
  pickBestBotForSession,
  updateWarmSession,
  upsertBotWarmScore,
  WARM_BR_LOCATIONS,
  WARM_CASUAL_TEXTS,
  WARM_REACTIONS,
  type WarmSession
} from "./chip-warmer.js";
import { fetchBotGroups, sendWarmAction, getWaPhoneForBot } from "../whatsapp-runtime.js";

const MIN_TICK_GAP_MS = 8 * 60 * 1000;
const lastDayKey = new Map<string, string>();

function isRiskyHour(hour: number) {
  return hour < 7 || hour >= 22;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function sessionAgeDays(session: WarmSession) {
  const ms = Date.now() - new Date(session.startedAt).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

async function maybeAdvanceDay(session: WarmSession) {
  const { year, month, day } = saoPauloNowParts();
  const key = `${year}-${month}-${day}`;
  const prev = lastDayKey.get(session.id);
  if (prev === key) return session;
  lastDayKey.set(session.id, key);

  if (session.messagesToday > 0 || prev) {
    if (session.dayIndex >= 10) {
      session.status = "completed";
      session.lastLog = "Ciclo de 10 dias concluído.";
    } else {
      session.dayIndex += 1;
      session.lastLog = `Novo dia do ciclo: ${session.dayIndex}/10`;
    }
    session.messagesToday = 0;
    await updateWarmSession(session);
  }
  return session;
}

async function pickWarmImagePath(botId: string): Promise<string | null> {
  const bots = await loadBots();
  const bot = bots.find((b) => b.id === botId);
  const preview = bot?.previewMediaUrls?.find((u) => /\.(jpe?g|png|webp)$/i.test(u));
  if (preview?.startsWith("/")) {
    const local = path.join(rootDir, preview.replace(/^\//, ""));
    try {
      await fs.access(local);
      return local;
    } catch {
      // fallthrough
    }
  }
  const fallback = path.join(rootDir, "hotbot", "precos.jpg");
  try {
    await fs.access(fallback);
    return fallback;
  } catch {
    return null;
  }
}

async function pickWarmAudioPath(botId: string): Promise<string | null> {
  const bots = await loadBots();
  const bot = bots.find((b) => b.id === botId);
  const audio = bot?.audioLibrary?.find((a) => a.url?.includes(".mp3"));
  if (audio?.url) {
    const local =
      audio.url.startsWith("/seed-audios/")
        ? path.join(rootDir, "assets", "seed-audios", path.basename(audio.url))
        : audio.url.startsWith("/")
          ? path.join(rootDir, audio.url.replace(/^\//, ""))
          : audio.url;
    try {
      await fs.access(local);
      return local;
    } catch {
      // fallthrough
    }
  }
  const seedDir = path.join(rootDir, "assets", "seed-audios");
  try {
    const files = await fs.readdir(seedDir);
    const mp3 = files.find((f) => f.endsWith(".mp3"));
    if (mp3) return path.join(seedDir, mp3);
  } catch {
    // ignore
  }
  return null;
}

async function processSession(session: WarmSession) {
  session = await maybeAdvanceDay(session);
  if (session.status !== "active") return;

  const { hour } = saoPauloNowParts();
  if (isRiskyHour(hour)) return;

  const goal = effectiveDailyGoal(session);
  if (session.messagesToday >= goal) {
    session.lastLog = `Meta diária atingida (${session.messagesToday}/${goal})`;
    await updateWarmSession(session);
    return;
  }

  if (session.lastTickAt) {
    const gap = Date.now() - new Date(session.lastTickAt).getTime();
    if (gap < MIN_TICK_GAP_MS) return;
  }

  const bots = await loadBots(session.userId);
  const scores = await getBotWarmScores(session.userId, session.botIds);
  const botId = pickBestBotForSession(session, bots, scores);
  if (!botId) return;

  const groupId =
    session.mode === "groups" && session.groupIds.length > 0
      ? pickRandom(session.groupIds)
      : null;

  if (session.mode === "groups" && !groupId) return;

  const otherBotId = session.botIds.find((id) => id !== botId) ?? botId;
  let chatId = groupId;
  if (session.mode === "p2p") {
    const otherBot = bots.find((b) => b.id === otherBotId);
    if (!otherBot) return;
    const phone = await getWaPhoneForBot(otherBot);
    if (!phone) return;
    const digits = phone.replace(/\D/g, "");
    chatId = `${digits}@c.us`;
  }
  if (!chatId) return;

  const roll = Math.random();
  let action: Parameters<typeof sendWarmAction>[0]["action"];
  if (roll < 0.5) action = "text";
  else if (roll < 0.65) action = "reaction";
  else if (roll < 0.78) action = "audio";
  else if (roll < 0.9) action = "image";
  else if (roll < 0.96) action = "location";
  else action = "quote";

  try {
    if (action === "text") {
      await sendWarmAction({ botId, chatId, action: "text", text: pickRandom(WARM_CASUAL_TEXTS) });
      session.stats.texts += 1;
    } else if (action === "reaction") {
      await sendWarmAction({
        botId,
        chatId,
        action: "reaction",
        emoji: pickRandom(WARM_REACTIONS)
      });
      session.stats.reactions += 1;
    } else if (action === "audio") {
      const mediaPath = await pickWarmAudioPath(botId);
      if (!mediaPath) {
        await sendWarmAction({ botId, chatId, action: "text", text: pickRandom(WARM_CASUAL_TEXTS) });
        session.stats.texts += 1;
      } else {
        await sendWarmAction({ botId, chatId, action: "audio", mediaPath });
        session.stats.audios += 1;
      }
    } else if (action === "image") {
      const mediaPath = await pickWarmImagePath(botId);
      if (!mediaPath) {
        await sendWarmAction({ botId, chatId, action: "text", text: pickRandom(WARM_CASUAL_TEXTS) });
        session.stats.texts += 1;
      } else {
        await sendWarmAction({ botId, chatId, action: "image", mediaPath });
        session.stats.images += 1;
      }
    } else if (action === "location") {
      const loc = pickRandom(WARM_BR_LOCATIONS);
      await sendWarmAction({
        botId,
        chatId,
        action: "location",
        latitude: loc.latitude,
        longitude: loc.longitude,
        locationName: loc.name
      });
      session.stats.locations += 1;
    } else {
      await sendWarmAction({
        botId,
        chatId,
        action: "quote",
        text: pickRandom(WARM_CASUAL_TEXTS)
      });
      session.stats.quotes += 1;
    }

    session.messagesToday += 1;
    session.messagesTotal += 1;
    session.lastTickAt = new Date().toISOString();
    session.lastLog = `[OK] ${action} via ${botId.slice(0, 8)}…`;

    const health = computeHealthScore({
      dayIndex: session.dayIndex,
      messagesToday: session.messagesToday,
      dailyGoal: goal,
      sessionAgeDays: sessionAgeDays(session)
    });

    await upsertBotWarmScore({
      botId,
      userId: session.userId,
      healthScore: health,
      warmLevel: Math.min(100, session.dayIndex * 10),
      messagesSent: 1
    });

    await updateWarmSession(session);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    session.lastLog = `[ERRO] ${msg}`;
    session.lastTickAt = new Date().toISOString();
    await updateWarmSession(session);
  }
}

export async function processChipWarmerTick() {
  const sessions = await listActiveWarmSessions();
  for (const session of sessions) {
    await processSession(session);
  }
}

export async function discoverCommonGroupsForBots(userId: string, botIds: string[]) {
  const maps = new Map<string, { id: string; name: string }[]>();
  for (const botId of botIds) {
    const groups = await fetchBotGroups(botId);
    maps.set(botId, groups);
  }
  const { findCommonGroups, cacheBotGroups } = await import("./chip-warmer.js");
  for (const [botId, groups] of maps) {
    await cacheBotGroups(botId, userId, groups);
  }
  return findCommonGroups(maps);
}
