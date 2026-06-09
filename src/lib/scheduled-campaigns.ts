import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config.js";
import { getPool, useDatabase } from "../db/index.js";
import { getBotById, type BotConfig } from "../bots.js";
import { sendRemarketingMulti } from "./remarketing.js";

const filePath = path.join(env.DATA_DIR, "scheduled-campaigns.json");

export type ScheduledCampaign = {
  id: string;
  userId: string;
  botIds: string[];
  sequence: string[];
  sequenceDelayMs: number;
  messagesByBot: Record<string, { chatId: number; message: string }[]>;
  scheduledAt: string;
  status: "pending" | "running" | "done" | "failed";
  resultSummary?: string;
  createdAt: string;
};

type FileStore = { campaigns: ScheduledCampaign[] };

async function loadFile(): Promise<FileStore> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return { campaigns: JSON.parse(raw).campaigns ?? [] };
  } catch {
    return { campaigns: [] };
  }
}

async function saveFile(store: FileStore) {
  await fs.mkdir(env.DATA_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2));
}

export async function initScheduledCampaignsSchema() {
  if (!useDatabase()) return;
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS scheduled_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      bot_ids JSONB NOT NULL DEFAULT '[]',
      sequence JSONB NOT NULL DEFAULT '[]',
      sequence_delay_ms INTEGER NOT NULL DEFAULT 8000,
      messages_by_bot JSONB NOT NULL DEFAULT '{}',
      scheduled_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result_summary TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function rowToCampaign(row: {
  id: string;
  user_id: string;
  bot_ids: string[] | string;
  sequence: string[] | string;
  sequence_delay_ms: number;
  messages_by_bot: Record<string, { chatId: number; message: string }[]> | string;
  scheduled_at: Date | string;
  status: string;
  result_summary?: string | null;
  created_at: Date | string;
}): ScheduledCampaign {
  const botIds =
    typeof row.bot_ids === "string" ? (JSON.parse(row.bot_ids) as string[]) : row.bot_ids;
  const sequence =
    typeof row.sequence === "string" ? (JSON.parse(row.sequence) as string[]) : row.sequence;
  const messagesByBot =
    typeof row.messages_by_bot === "string"
      ? (JSON.parse(row.messages_by_bot) as ScheduledCampaign["messagesByBot"])
      : row.messages_by_bot;
  return {
    id: row.id,
    userId: row.user_id,
    botIds,
    sequence,
    sequenceDelayMs: row.sequence_delay_ms,
    messagesByBot: messagesByBot ?? {},
    scheduledAt: new Date(row.scheduled_at).toISOString(),
    status: row.status as ScheduledCampaign["status"],
    resultSummary: row.result_summary ?? undefined,
    createdAt: new Date(row.created_at).toISOString()
  };
}

export async function createScheduledCampaign(input: Omit<ScheduledCampaign, "id" | "status" | "createdAt">) {
  const campaign: ScheduledCampaign = {
    ...input,
    id: randomUUID(),
    status: "pending",
    createdAt: new Date().toISOString()
  };

  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO scheduled_campaigns (id, user_id, bot_ids, sequence, sequence_delay_ms, messages_by_bot, scheduled_at, status, created_at)
       VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6::jsonb,$7,$8,$9)`,
      [
        campaign.id,
        campaign.userId,
        JSON.stringify(campaign.botIds),
        JSON.stringify(campaign.sequence),
        campaign.sequenceDelayMs,
        JSON.stringify(campaign.messagesByBot),
        campaign.scheduledAt,
        campaign.status,
        campaign.createdAt
      ]
    );
    return campaign;
  }

  const store = await loadFile();
  store.campaigns.push(campaign);
  await saveFile(store);
  return campaign;
}

export async function listScheduledCampaigns(userId: string, limit = 20) {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT * FROM scheduled_campaigns WHERE user_id = $1 ORDER BY scheduled_at DESC LIMIT $2`,
      [userId, limit]
    );
    return rows.map(rowToCampaign);
  }
  const store = await loadFile();
  return store.campaigns
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
    .slice(0, limit);
}

export async function cancelScheduledCampaign(id: string, userId: string) {
  if (useDatabase()) {
    await getPool().query(
      `DELETE FROM scheduled_campaigns WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
      [id, userId]
    );
    return;
  }
  const store = await loadFile();
  store.campaigns = store.campaigns.filter((c) => !(c.id === id && c.userId === userId && c.status === "pending"));
  await saveFile(store);
}

export async function processDueScheduledCampaigns() {
  const now = new Date();
  let due: ScheduledCampaign[] = [];

  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT * FROM scheduled_campaigns WHERE status = 'pending' AND scheduled_at <= $1 ORDER BY scheduled_at ASC LIMIT 10`,
      [now.toISOString()]
    );
    due = rows.map(rowToCampaign);
  } else {
    const store = await loadFile();
    due = store.campaigns.filter((c) => c.status === "pending" && new Date(c.scheduledAt) <= now);
  }

  for (const campaign of due) {
    await runCampaign(campaign);
  }
}

async function runCampaign(campaign: ScheduledCampaign) {
  const mark = async (status: ScheduledCampaign["status"], resultSummary?: string) => {
    if (useDatabase()) {
      await getPool().query(
        `UPDATE scheduled_campaigns SET status = $2, result_summary = $3 WHERE id = $1`,
        [campaign.id, status, resultSummary ?? null]
      );
      return;
    }
    const store = await loadFile();
    const idx = store.campaigns.findIndex((c) => c.id === campaign.id);
    if (idx >= 0) {
      store.campaigns[idx].status = status;
      store.campaigns[idx].resultSummary = resultSummary;
    }
    await saveFile(store);
  };

  await mark("running");

  try {
    const bots: BotConfig[] = [];
    for (const botId of campaign.botIds) {
      const bot = await getBotById(botId, campaign.userId);
      if (bot?.active) bots.push(bot);
    }
    if (bots.length === 0) {
      await mark("failed", "Nenhuma instância ativa encontrada.");
      return;
    }

    const messagesByBot = new Map<string, { chatId: number; message: string }[]>();
    for (const [botId, msgs] of Object.entries(campaign.messagesByBot)) {
      messagesByBot.set(botId, msgs);
    }

    const result = await sendRemarketingMulti({
      bots,
      messagesByBot,
      sequence: campaign.sequence,
      sequenceDelayMs: campaign.sequenceDelayMs
    });

    await mark(
      "done",
      `Enviadas: ${result.sent}, falhas: ${result.failed}, sem msg: ${result.skipped}, leads: ${result.total}`
    );
  } catch (error) {
    await mark("failed", error instanceof Error ? error.message : "Erro ao disparar campanha.");
  }
}
