import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config.js";
import { getPool, useDatabase } from "../db/index.js";
import { getBotByIdAny, type BotConfig } from "../bots.js";
import { pickGiftMessage } from "./gifts.js";
import { jidFromChatId, sendWaMessage } from "../whatsapp-runtime.js";
import { sendTgMessage } from "../telegram-runtime.js";
import { isTelegramBot } from "../bots.js";
import { createChatCompletionForBot } from "./ai-chat.js";

const filePath = path.join(env.DATA_DIR, "post-sale-jobs.json");

export type PostSaleStage = "scheduled" | "reopened" | "warmed" | "gift_asked" | "done";

export type PostSaleJob = {
  id: string;
  saleId?: string;
  botId: string;
  chatId: number;
  stage: PostSaleStage;
  runAt: string;
  warmupReplies: number;
  attempts: number;
  createdAt: string;
};

type FileStore = { jobs: PostSaleJob[] };

async function loadFile(): Promise<FileStore> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return { jobs: JSON.parse(raw).jobs ?? [] };
  } catch {
    return { jobs: [] };
  }
}

async function saveFile(store: FileStore) {
  await fs.mkdir(env.DATA_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2));
}

export async function initPostSaleSchema() {
  if (!useDatabase()) return;
  await getPool().query(`
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS post_sale_enabled BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS post_sale_wait_days INTEGER NOT NULL DEFAULT 2;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS post_sale_opener_prompt TEXT NOT NULL DEFAULT '';
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS post_sale_warmup_replies INTEGER NOT NULL DEFAULT 2;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS post_sale_gift_delay_minutes INTEGER NOT NULL DEFAULT 45;

    CREATE TABLE IF NOT EXISTS post_sale_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sale_id UUID,
      bot_id UUID NOT NULL,
      chat_id BIGINT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'scheduled',
      run_at TIMESTAMPTZ NOT NULL,
      warmup_replies INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function schedulePostSaleJob(input: {
  botId: string;
  chatId: number;
  saleId?: string;
  waitDays: number;
}) {
  const runAt = new Date(Date.now() + Math.max(1, input.waitDays) * 24 * 60 * 60 * 1000);
  const job: PostSaleJob = {
    id: randomUUID(),
    saleId: input.saleId,
    botId: input.botId,
    chatId: input.chatId,
    stage: "scheduled",
    runAt: runAt.toISOString(),
    warmupReplies: 0,
    attempts: 0,
    createdAt: new Date().toISOString()
  };

  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO post_sale_jobs (id, sale_id, bot_id, chat_id, stage, run_at, warmup_replies, attempts, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        job.id,
        job.saleId ?? null,
        job.botId,
        job.chatId,
        job.stage,
        job.runAt,
        job.warmupReplies,
        job.attempts,
        job.createdAt
      ]
    );
    return job;
  }

  const store = await loadFile();
  store.jobs.push(job);
  await saveFile(store);
  return job;
}

async function listDueJobs(): Promise<PostSaleJob[]> {
  const now = new Date().toISOString();
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT id, sale_id, bot_id, chat_id, stage, run_at, warmup_replies, attempts, created_at
       FROM post_sale_jobs
       WHERE stage NOT IN ('done') AND run_at <= $1 AND attempts < 5
       ORDER BY run_at ASC LIMIT 20`,
      [now]
    );
    return rows.map((r) => ({
      id: String(r.id),
      saleId: r.sale_id ? String(r.sale_id) : undefined,
      botId: String(r.bot_id),
      chatId: Number(r.chat_id),
      stage: r.stage as PostSaleStage,
      runAt: new Date(r.run_at).toISOString(),
      warmupReplies: Number(r.warmup_replies ?? 0),
      attempts: Number(r.attempts ?? 0),
      createdAt: new Date(r.created_at).toISOString()
    }));
  }
  const store = await loadFile();
  return store.jobs.filter((j) => j.stage !== "done" && j.runAt <= now && j.attempts < 5);
}

async function updateJob(job: PostSaleJob) {
  if (useDatabase()) {
    await getPool().query(
      `UPDATE post_sale_jobs SET stage=$2, run_at=$3, warmup_replies=$4, attempts=$5 WHERE id=$1`,
      [job.id, job.stage, job.runAt, job.warmupReplies, job.attempts]
    );
    return;
  }
  const store = await loadFile();
  const idx = store.jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) store.jobs[idx] = job;
  await saveFile(store);
}

async function generatePostSaleLine(bot: BotConfig, instruction: string) {
  try {
    const completion = await createChatCompletionForBot(bot, {
      temperature: 0.85,
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: `${bot.prompt}\n\n${instruction}\nUma frase curta, informal, max 2 frases.`
        }
      ]
    });
    return completion.choices[0]?.message?.content?.trim() || "";
  } catch {
    return "";
  }
}

async function sendPostSaleMessage(bot: BotConfig, chatId: number, message: string) {
  if (isTelegramBot(bot)) {
    await sendTgMessage({ botId: bot.id, chatId, message, postSale: true });
    return;
  }
  const jid = jidFromChatId(chatId);
  await sendWaMessage({ botId: bot.id, jid, message, postSale: true });
}

export async function processDuePostSaleJobs() {
  const due = await listDueJobs();
  for (const job of due) {
    const bot = await getBotByIdAny(job.botId);
    if (!bot?.active || !bot.postSaleEnabled) {
      job.stage = "done";
      await updateJob(job);
      continue;
    }

    job.attempts += 1;

    try {
      if (job.stage === "scheduled") {
        const opener =
          (await generatePostSaleLine(
            bot,
            bot.postSaleOpenerPrompt?.trim() ||
              "Voce vendeu conteudo pra esse lead dias atras. Reabra a conversa com carinho, sem falar de venda. Puxe assunto leve."
          )) || "oii amor, sumiu? 😊";
        await sendPostSaleMessage(bot, job.chatId, opener);
        job.stage = "reopened";
        job.runAt = new Date(Date.now() + 60_000).toISOString();
      } else if (job.stage === "reopened") {
        job.warmupReplies += 1;
        const target = Math.max(1, bot.postSaleWarmupReplies ?? 2);
        if (job.warmupReplies >= target) {
          job.stage = "warmed";
          job.runAt = new Date(
            Date.now() + Math.max(5, bot.postSaleGiftDelayMinutes ?? 45) * 60_000
          ).toISOString();
        } else {
          job.runAt = new Date(Date.now() + 90_000).toISOString();
        }
      } else if (job.stage === "warmed") {
        const giftMsg =
          pickGiftMessage(bot.giftItems ?? []) ||
          (await generatePostSaleLine(
            bot,
            bot.giftPrompt?.trim() ||
              "Peca um presente/mimo com naturalidade (ex: um acai), sem parecer cobranca."
          )) ||
          "amor, me ajuda com um mimo? to com vontade de um acai 😘";
        await sendPostSaleMessage(bot, job.chatId, giftMsg);
        job.stage = "gift_asked";
        job.runAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
      } else if (job.stage === "gift_asked") {
        job.stage = "done";
      }
    } catch (err) {
      console.error("[post-sale] job failed:", job.id, err);
      job.runAt = new Date(Date.now() + 30 * 60_000).toISOString();
    }

    await updateJob(job);
  }
}

export async function onPostSaleUserReply(botId: string, chatId: number) {
  const jobs = useDatabase()
    ? (
        await getPool().query(
          `SELECT * FROM post_sale_jobs WHERE bot_id=$1 AND chat_id=$2 AND stage IN ('reopened','warmed') ORDER BY created_at DESC LIMIT 1`,
          [botId, chatId]
        )
      ).rows
    : (await loadFile()).jobs.filter(
        (j) => j.botId === botId && j.chatId === chatId && (j.stage === "reopened" || j.stage === "warmed")
      );

  if (!jobs.length) return;
  const raw = jobs[0];
  const job: PostSaleJob = useDatabase()
    ? {
        id: String(raw.id),
        botId: String(raw.bot_id),
        chatId: Number(raw.chat_id),
        stage: raw.stage as PostSaleStage,
        runAt: new Date(raw.run_at).toISOString(),
        warmupReplies: Number(raw.warmup_replies ?? 0),
        attempts: Number(raw.attempts ?? 0),
        createdAt: new Date(raw.created_at).toISOString()
      }
    : (raw as PostSaleJob);

  if (job.stage === "reopened") {
    job.warmupReplies += 1;
    const bot = await getBotByIdAny(botId);
    const target = Math.max(1, bot?.postSaleWarmupReplies ?? 2);
    if (job.warmupReplies >= target) {
      job.stage = "warmed";
      job.runAt = new Date(
        Date.now() + Math.max(5, bot?.postSaleGiftDelayMinutes ?? 45) * 60_000
      ).toISOString();
    }
    await updateJob(job);
  }
}
