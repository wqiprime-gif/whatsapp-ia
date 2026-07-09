import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config.js";
import { getPool, useDatabase } from "../db/index.js";
import { loadBots, type BotConfig } from "../bots.js";

const storeFile = path.join(env.DATA_DIR, "chip-warmer.json");

export type WarmSessionStatus = "active" | "paused" | "completed";
export type WarmMode = "groups" | "p2p";

export type WarmGroupMeta = {
  id: string;
  name: string;
};

export type WarmSessionStats = {
  texts: number;
  audios: number;
  reactions: number;
  images: number;
  locations: number;
  mentions: number;
  quotes: number;
};

export type WarmSession = {
  id: string;
  userId: string;
  name: string;
  status: WarmSessionStatus;
  mode: WarmMode;
  dayIndex: number;
  startedAt: string;
  botIds: string[];
  groupIds: string[];
  groupsMeta: WarmGroupMeta[];
  dailyMessageGoal: number;
  messagesToday: number;
  messagesTotal: number;
  stats: WarmSessionStats;
  lastTickAt?: string;
  lastLog?: string;
  createdAt: string;
};

export type BotWarmScore = {
  botId: string;
  userId: string;
  healthScore: number;
  warmLevel: number;
  messagesSent: number;
  lastActionAt?: string;
  updatedAt: string;
};

export type CachedBotGroups = {
  botId: string;
  userId: string;
  groups: WarmGroupMeta[];
  fetchedAt: string;
};

type FileStore = {
  sessions: WarmSession[];
  scores: BotWarmScore[];
  groupCache: CachedBotGroups[];
};

const emptyStats = (): WarmSessionStats => ({
  texts: 0,
  audios: 0,
  reactions: 0,
  images: 0,
  locations: 0,
  mentions: 0,
  quotes: 0
});

async function loadFile(): Promise<FileStore> {
  try {
    const raw = await fs.readFile(storeFile, "utf8");
    const data = JSON.parse(raw) as Partial<FileStore>;
    return {
      sessions: data.sessions ?? [],
      scores: data.scores ?? [],
      groupCache: data.groupCache ?? []
    };
  } catch {
    return { sessions: [], scores: [], groupCache: [] };
  }
}

async function saveFile(store: FileStore) {
  await fs.mkdir(env.DATA_DIR, { recursive: true });
  await fs.writeFile(storeFile, JSON.stringify(store, null, 2));
}

function rowToSession(row: Record<string, unknown>): WarmSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    status: row.status as WarmSessionStatus,
    mode: (row.mode as WarmMode) || "groups",
    dayIndex: Number(row.day_index || 1),
    startedAt: new Date(String(row.started_at)).toISOString(),
    botIds: (row.bot_ids as string[]) ?? [],
    groupIds: (row.group_ids as string[]) ?? [],
    groupsMeta: (row.groups_meta as WarmGroupMeta[]) ?? [],
    dailyMessageGoal: Number(row.daily_message_goal || 300),
    messagesToday: Number(row.messages_today || 0),
    messagesTotal: Number(row.messages_total || 0),
    stats: { ...emptyStats(), ...((row.stats as WarmSessionStats) ?? {}) },
    lastTickAt: row.last_tick_at ? new Date(String(row.last_tick_at)).toISOString() : undefined,
    lastLog: row.last_log ? String(row.last_log) : undefined,
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

export async function initChipWarmerSchema() {
  if (!useDatabase()) return;
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS chip_warm_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES panel_users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      mode TEXT NOT NULL DEFAULT 'groups',
      day_index INTEGER NOT NULL DEFAULT 1,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      bot_ids JSONB NOT NULL DEFAULT '[]',
      group_ids JSONB NOT NULL DEFAULT '[]',
      groups_meta JSONB NOT NULL DEFAULT '[]',
      daily_message_goal INTEGER NOT NULL DEFAULT 300,
      messages_today INTEGER NOT NULL DEFAULT 0,
      messages_total INTEGER NOT NULL DEFAULT 0,
      stats JSONB NOT NULL DEFAULT '{}',
      last_tick_at TIMESTAMPTZ,
      last_log TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chip_warm_bot_scores (
      bot_id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      health_score INTEGER NOT NULL DEFAULT 50,
      warm_level INTEGER NOT NULL DEFAULT 0,
      messages_sent INTEGER NOT NULL DEFAULT 0,
      last_action_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chip_warm_groups_cache (
      bot_id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      groups JSONB NOT NULL DEFAULT '[]',
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_chip_warm_sessions_user ON chip_warm_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_chip_warm_sessions_status ON chip_warm_sessions(status);
  `);
}

export async function listWarmSessions(userId: string): Promise<WarmSession[]> {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT * FROM chip_warm_sessions WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map((r) => rowToSession(r));
  }
  const store = await loadFile();
  return store.sessions.filter((s) => s.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listActiveWarmSessions(): Promise<WarmSession[]> {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT * FROM chip_warm_sessions WHERE status = 'active' ORDER BY created_at ASC`
    );
    return rows.map((r) => rowToSession(r));
  }
  const store = await loadFile();
  return store.sessions.filter((s) => s.status === "active");
}

export async function getWarmSession(id: string, userId?: string): Promise<WarmSession | null> {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      userId ? `SELECT * FROM chip_warm_sessions WHERE id = $1 AND user_id = $2` : `SELECT * FROM chip_warm_sessions WHERE id = $1`,
      userId ? [id, userId] : [id]
    );
    return rows[0] ? rowToSession(rows[0]) : null;
  }
  const store = await loadFile();
  const hit = store.sessions.find((s) => s.id === id && (!userId || s.userId === userId));
  return hit ?? null;
}

export async function createWarmSession(input: {
  userId: string;
  name: string;
  mode: WarmMode;
  botIds: string[];
  groupIds: string[];
  groupsMeta: WarmGroupMeta[];
  dailyMessageGoal?: number;
}): Promise<WarmSession> {
  if (input.botIds.length < 2) throw new Error("Selecione pelo menos 2 instâncias.");
  if (input.mode === "groups" && input.groupIds.length < 1) {
    throw new Error("Selecione pelo menos 1 grupo em comum.");
  }

  const bots = await loadBots(input.userId);
  for (const id of input.botIds) {
    if (!bots.some((b) => b.id === id)) throw new Error("Instância inválida.");
  }

  const session: WarmSession = {
    id: randomUUID(),
    userId: input.userId,
    name: input.name.trim() || `Aquecimento ${new Date().toLocaleDateString("pt-BR")}`,
    status: "active",
    mode: input.mode,
    dayIndex: 1,
    startedAt: new Date().toISOString(),
    botIds: input.botIds,
    groupIds: input.groupIds,
    groupsMeta: input.groupsMeta,
    dailyMessageGoal: input.dailyMessageGoal ?? Math.max(60, input.botIds.length * 30),
    messagesToday: 0,
    messagesTotal: 0,
    stats: emptyStats(),
    createdAt: new Date().toISOString()
  };

  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO chip_warm_sessions
       (id, user_id, name, status, mode, day_index, started_at, bot_ids, group_ids, groups_meta,
        daily_message_goal, messages_today, messages_total, stats, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14::jsonb,$15)`,
      [
        session.id,
        session.userId,
        session.name,
        session.status,
        session.mode,
        session.dayIndex,
        session.startedAt,
        JSON.stringify(session.botIds),
        JSON.stringify(session.groupIds),
        JSON.stringify(session.groupsMeta),
        session.dailyMessageGoal,
        session.messagesToday,
        session.messagesTotal,
        JSON.stringify(session.stats),
        session.createdAt
      ]
    );
    return session;
  }

  const store = await loadFile();
  store.sessions.push(session);
  await saveFile(store);
  return session;
}

export async function updateWarmSession(session: WarmSession) {
  if (useDatabase()) {
    await getPool().query(
      `UPDATE chip_warm_sessions SET
         name = $2, status = $3, mode = $4, day_index = $5, bot_ids = $6::jsonb,
         group_ids = $7::jsonb, groups_meta = $8::jsonb, daily_message_goal = $9,
         messages_today = $10, messages_total = $11, stats = $12::jsonb,
         last_tick_at = $13, last_log = $14
       WHERE id = $1`,
      [
        session.id,
        session.name,
        session.status,
        session.mode,
        session.dayIndex,
        JSON.stringify(session.botIds),
        JSON.stringify(session.groupIds),
        JSON.stringify(session.groupsMeta),
        session.dailyMessageGoal,
        session.messagesToday,
        session.messagesTotal,
        JSON.stringify(session.stats),
        session.lastTickAt ?? null,
        session.lastLog ?? null
      ]
    );
    return;
  }
  const store = await loadFile();
  const idx = store.sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) store.sessions[idx] = session;
  await saveFile(store);
}

export async function setWarmSessionStatus(id: string, userId: string, status: WarmSessionStatus) {
  const session = await getWarmSession(id, userId);
  if (!session) throw new Error("Sessão não encontrada.");
  session.status = status;
  await updateWarmSession(session);
}

export async function cacheBotGroups(botId: string, userId: string, groups: WarmGroupMeta[]) {
  const entry: CachedBotGroups = {
    botId,
    userId,
    groups,
    fetchedAt: new Date().toISOString()
  };
  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO chip_warm_groups_cache (bot_id, user_id, groups, fetched_at)
       VALUES ($1,$2,$3::jsonb,$4)
       ON CONFLICT (bot_id) DO UPDATE SET groups = EXCLUDED.groups, fetched_at = EXCLUDED.fetched_at`,
      [botId, userId, JSON.stringify(groups), entry.fetchedAt]
    );
    return;
  }
  const store = await loadFile();
  const idx = store.groupCache.findIndex((g) => g.botId === botId);
  if (idx >= 0) store.groupCache[idx] = entry;
  else store.groupCache.push(entry);
  await saveFile(store);
}

export async function getCachedBotGroups(botId: string): Promise<CachedBotGroups | null> {
  if (useDatabase()) {
    const { rows } = await getPool().query(`SELECT * FROM chip_warm_groups_cache WHERE bot_id = $1`, [botId]);
    if (!rows[0]) return null;
    return {
      botId: String(rows[0].bot_id),
      userId: String(rows[0].user_id),
      groups: (rows[0].groups as WarmGroupMeta[]) ?? [],
      fetchedAt: new Date(String(rows[0].fetched_at)).toISOString()
    };
  }
  const store = await loadFile();
  return store.groupCache.find((g) => g.botId === botId) ?? null;
}

export function findCommonGroups(maps: Map<string, WarmGroupMeta[]>): WarmGroupMeta[] {
  if (maps.size < 2) return [];
  const lists = [...maps.values()];
  const first = lists[0]!;
  const restIds = lists.slice(1).map((g) => new Set(g.map((x) => x.id)));
  return first.filter((g) => restIds.every((set) => set.has(g.id)));
}

export function computeHealthScore(input: {
  dayIndex: number;
  messagesToday: number;
  dailyGoal: number;
  sessionAgeDays: number;
}): number {
  const maturation = Math.min(40, (input.dayIndex / 10) * 40);
  const ageBonus = Math.min(20, input.sessionAgeDays * 2);
  const volumeRatio = input.dailyGoal > 0 ? input.messagesToday / input.dailyGoal : 0;
  const volumePenalty = volumeRatio > 1 ? Math.min(25, (volumeRatio - 1) * 30) : 0;
  const base = 25 + maturation + ageBonus - volumePenalty;
  return Math.max(5, Math.min(100, Math.round(base)));
}

export function effectiveDailyGoal(session: WarmSession): number {
  const ramp = Math.max(0.3, session.dayIndex / 10);
  return Math.round(session.dailyMessageGoal * ramp);
}

export async function upsertBotWarmScore(input: {
  botId: string;
  userId: string;
  healthScore: number;
  warmLevel: number;
  messagesSent: number;
}) {
  const now = new Date().toISOString();
  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO chip_warm_bot_scores (bot_id, user_id, health_score, warm_level, messages_sent, last_action_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (bot_id) DO UPDATE SET
         health_score = EXCLUDED.health_score,
         warm_level = EXCLUDED.warm_level,
         messages_sent = chip_warm_bot_scores.messages_sent + EXCLUDED.messages_sent,
         last_action_at = EXCLUDED.last_action_at,
         updated_at = EXCLUDED.updated_at`,
      [input.botId, input.userId, input.healthScore, input.warmLevel, input.messagesSent, now, now]
    );
    return;
  }
  const store = await loadFile();
  const idx = store.scores.findIndex((s) => s.botId === input.botId);
  if (idx >= 0) {
    store.scores[idx] = {
      ...store.scores[idx]!,
      healthScore: input.healthScore,
      warmLevel: input.warmLevel,
      messagesSent: store.scores[idx]!.messagesSent + input.messagesSent,
      lastActionAt: now,
      updatedAt: now
    };
  } else {
    store.scores.push({
      botId: input.botId,
      userId: input.userId,
      healthScore: input.healthScore,
      warmLevel: input.warmLevel,
      messagesSent: input.messagesSent,
      lastActionAt: now,
      updatedAt: now
    });
  }
  await saveFile(store);
}

export async function getBotWarmScores(userId: string, botIds: string[]): Promise<Record<string, BotWarmScore>> {
  const out: Record<string, BotWarmScore> = {};
  if (botIds.length === 0) return out;

  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT * FROM chip_warm_bot_scores WHERE user_id = $1 AND bot_id = ANY($2::uuid[])`,
      [userId, botIds]
    );
    for (const row of rows) {
      out[String(row.bot_id)] = {
        botId: String(row.bot_id),
        userId: String(row.user_id),
        healthScore: Number(row.health_score),
        warmLevel: Number(row.warm_level),
        messagesSent: Number(row.messages_sent),
        lastActionAt: row.last_action_at ? new Date(String(row.last_action_at)).toISOString() : undefined,
        updatedAt: new Date(String(row.updated_at)).toISOString()
      };
    }
    return out;
  }

  const store = await loadFile();
  for (const s of store.scores) {
    if (s.userId === userId && botIds.includes(s.botId)) out[s.botId] = s;
  }
  return out;
}

export async function countWarmingChipsByUser(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const sessions = await listActiveWarmSessions();
  for (const s of sessions) {
    out[s.userId] = (out[s.userId] ?? 0) + s.botIds.length;
  }
  return out;
}

export async function countPlatformWarmingChips(): Promise<number> {
  const map = await countWarmingChipsByUser();
  return Object.values(map).reduce((a, b) => a + b, 0);
}

export async function purgeWarmDataForUser(userId: string) {
  if (useDatabase()) {
    await getPool().query(`DELETE FROM chip_warm_sessions WHERE user_id = $1`, [userId]);
    await getPool().query(`DELETE FROM chip_warm_bot_scores WHERE user_id = $1`, [userId]);
    await getPool().query(`DELETE FROM chip_warm_groups_cache WHERE user_id = $1`, [userId]);
    return;
  }
  const store = await loadFile();
  store.sessions = store.sessions.filter((s) => s.userId !== userId);
  store.scores = store.scores.filter((s) => s.userId !== userId);
  store.groupCache = store.groupCache.filter((g) => g.userId !== userId);
  await saveFile(store);
}

export function pickBestBotForSession(session: WarmSession, bots: BotConfig[], scores: Record<string, BotWarmScore>) {
  const eligible = session.botIds
    .map((id) => {
      const bot = bots.find((b) => b.id === id);
      const score = scores[id];
      return { id, bot, health: score?.healthScore ?? 50, sent: score?.messagesSent ?? 0 };
    })
    .filter((x) => x.bot);
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => b.health - a.health || a.sent - b.sent);
  return eligible[0]!.id;
}

export const WARM_CASUAL_TEXTS = [
  "bom dia pessoal",
  "e aí galera, tudo bem?",
  "alguém online?",
  "kkk verdade",
  "concordo",
  "show",
  "beleza então",
  "valeu!",
  "tô por aqui",
  "depois a gente conversa",
  "massa",
  "top",
  "entendi",
  "pode crer",
  "tranquilo",
  "blz",
  "👍",
  "😂",
  "🔥"
];

export const WARM_REACTIONS = ["👍", "😂", "❤️", "🔥", "🙏", "😮", "👏"];

export const WARM_BR_LOCATIONS = [
  { latitude: -23.5505, longitude: -46.6333, name: "São Paulo" },
  { latitude: -22.9068, longitude: -43.1729, name: "Rio de Janeiro" },
  { latitude: -12.9714, longitude: -38.5014, name: "Salvador" },
  { latitude: -19.9167, longitude: -43.9345, name: "Belo Horizonte" },
  { latitude: -30.0346, longitude: -51.2177, name: "Porto Alegre" },
  { latitude: -8.0476, longitude: -34.877, name: "Recife" }
];
