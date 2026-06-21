import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config.js";
import { getPool, useDatabase } from "./index.js";

export type NotificationPrefs = {
  enabled: boolean;
  sales: boolean;
  leads: boolean;
  instances: boolean;
  dailySummary: boolean;
  desktop: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  sales: true,
  leads: true,
  instances: true,
  dailySummary: true,
  desktop: true
};

const prefsFile = path.join(env.DATA_DIR, "notification-prefs.json");

function normalizePrefs(raw: unknown): NotificationPrefs {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    enabled: src.enabled !== false,
    sales: src.sales !== false,
    leads: src.leads !== false,
    instances: src.instances !== false,
    dailySummary: src.dailySummary !== false,
    desktop: src.desktop !== false
  };
}

async function loadFilePrefsMap(): Promise<Record<string, NotificationPrefs>> {
  try {
    const raw = await fs.readFile(prefsFile, "utf8");
    return JSON.parse(raw) as Record<string, NotificationPrefs>;
  } catch {
    return {};
  }
}

async function saveFilePrefsMap(map: Record<string, NotificationPrefs>) {
  await fs.mkdir(env.DATA_DIR, { recursive: true });
  await fs.writeFile(prefsFile, JSON.stringify(map, null, 2));
}

export async function initNotificationPrefsSchema() {
  if (!useDatabase()) return;
  await getPool().query(`
    ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{"enabled":true,"sales":true,"leads":true,"instances":true,"dailySummary":true,"desktop":true}'::jsonb;
  `);
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  if (useDatabase()) {
    const { rows } = await getPool().query<{ notification_prefs: unknown }>(
      `SELECT notification_prefs FROM user_settings WHERE user_id = $1`,
      [userId]
    );
    if (rows[0]) return normalizePrefs(rows[0].notification_prefs);
    await getPool().query(
      `INSERT INTO user_settings (user_id, openai_model, notification_prefs)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, env.OPENAI_MODEL, JSON.stringify(DEFAULT_NOTIFICATION_PREFS)]
    );
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }

  const map = await loadFilePrefsMap();
  return normalizePrefs(map[userId]);
}

export async function saveNotificationPrefs(userId: string, prefs: NotificationPrefs) {
  const next = normalizePrefs(prefs);
  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO user_settings (user_id, openai_model, notification_prefs)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET notification_prefs = EXCLUDED.notification_prefs, updated_at = NOW()`,
      [userId, env.OPENAI_MODEL, JSON.stringify(next)]
    );
    return next;
  }

  const map = await loadFilePrefsMap();
  map[userId] = next;
  await saveFilePrefsMap(map);
  return next;
}
