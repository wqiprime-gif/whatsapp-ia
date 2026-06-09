import fs from "node:fs/promises";
import pg from "pg";
import { botsFile, type BotConfig } from "../bots.js";
import { rootDir } from "../config.js";
import { env } from "../config.js";
import path from "node:path";

const settingsFile = path.join(rootDir, "data", "settings.json");

let pool: pg.Pool | null = null;
let dbAvailable = false;

export function useDatabase() {
  return dbAvailable;
}

function postgresSsl(url: string) {
  if (url.includes("sslmode=require") || url.includes("sslmode=verify")) {
    return { rejectUnauthorized: false };
  }
  // Rede interna do Railway (postgres.railway.internal) NAO usa SSL
  if (url.includes(".railway.internal") || url.includes("localhost")) return undefined;
  if (url.includes("railway.app") || url.includes("rlwy.net")) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function createPool() {
  const url = env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL nao configurada.");
  return new pg.Pool({
    connectionString: url,
    ssl: postgresSsl(url)
  });
}

export function getPool() {
  if (!dbAvailable || !pool) {
    throw new Error("PostgreSQL nao disponivel — use modo arquivo local.");
  }
  return pool;
}

async function migrateFromJsonFiles(db: pg.Pool) {

  const { rows: botCount } = await db.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM bots"
  );
  if (Number(botCount[0]?.count) === 0) {
    try {
      const raw = await fs.readFile(botsFile, "utf8");
      const bots = JSON.parse(raw) as BotConfig[];
      for (const bot of bots) {
        await db.query(
          `INSERT INTO bots (id, name, token, prompt, pix_key, message_delay_ms, preview_media_urls, delivery_media_urls, active)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)
           ON CONFLICT (id) DO NOTHING`,
          [
            bot.id,
            bot.name,
            bot.token,
            bot.prompt,
            bot.pixKey,
            bot.messageDelayMs,
            JSON.stringify(bot.previewMediaUrls),
            JSON.stringify(bot.deliveryMediaUrls),
            bot.active
          ]
        );
      }
      if (bots.length > 0) {
        console.log(`[db] Migrados ${bots.length} bot(s) de bots.json`);
      }
    } catch {
      // sem arquivo local
    }
  }

  const { rows: settingsRows } = await db.query("SELECT 1 FROM app_settings WHERE id = 1");
  if (settingsRows.length === 0) {
    try {
      const raw = await fs.readFile(settingsFile, "utf8");
      const settings = JSON.parse(raw) as {
        openaiApiKeyEncrypted?: string;
        openaiModel?: string;
      };
      await db.query(
        `INSERT INTO app_settings (id, openai_api_key_encrypted, openai_model)
         VALUES (1, $1, $2)`,
        [settings.openaiApiKeyEncrypted ?? null, settings.openaiModel ?? env.OPENAI_MODEL]
      );
      console.log("[db] Migrado settings.json");
    } catch {
      await db.query(
        `INSERT INTO app_settings (id, openai_model) VALUES (1, $1) ON CONFLICT (id) DO NOTHING`,
        [env.OPENAI_MODEL]
      );
    }
  }
}

export async function initDatabase() {
  dbAvailable = false;
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    console.log("[db] DATABASE_URL nao definida — usando arquivos em data/ (local apenas).");
    return;
  }

  let db: pg.Pool | undefined;
  try {
    db = createPool();
    await db.query("SELECT 1");
  } catch (error) {
    if (db) await db.end().catch(() => {});
    pool = null;
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[db] Postgres indisponivel (${msg}) — painel em modo arquivo (data/).`);
    if (url.includes("railway")) {
      console.warn("[db] Railway: confira DATABASE_URL referenciada ao Postgres e faca Redeploy.");
    }
    return;
  }

  pool = db;
  dbAvailable = true;

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS bots (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        token TEXT NOT NULL,
        prompt TEXT NOT NULL,
        pix_key TEXT NOT NULL,
        message_delay_ms INTEGER NOT NULL DEFAULT 1500,
        preview_media_urls JSONB NOT NULL DEFAULT '[]',
        delivery_media_urls JSONB NOT NULL DEFAULT '[]',
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        openai_api_key_encrypted TEXT,
        openai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const { initUsersSchema } = await import("./users.js");
    await initUsersSchema();

    const { initEventsSchema } = await import("./events.js");
    await initEventsSchema();

    const { initScheduledCampaignsSchema } = await import("../lib/scheduled-campaigns.js");
    await initScheduledCampaignsSchema();

    await migrateFromJsonFiles(db);

    console.log("[db] PostgreSQL conectado e schema pronto.");
  } catch (error) {
    await pool?.end().catch(() => {});
    pool = null;
    dbAvailable = false;
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[db] Erro ao preparar schema (${msg}) — modo arquivo em data/`);
  }
}
