import type pg from "pg";
import { getPool, useDatabase } from "./index.js";

export type TgSessionBackupRow = {
  session: string;
  backedUpAt: Date;
};

export async function initTgSessionSchema(db: pg.Pool) {
  await db.query(`
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS tg_session_backup TEXT;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS tg_session_backup_at TIMESTAMPTZ;
  `);
}

export async function saveTgSessionBackup(botId: string, session: string): Promise<void> {
  if (!useDatabase()) return;
  const trimmed = String(session || "").trim();
  if (!trimmed) return;
  const pool = getPool();
  await pool.query(
    `UPDATE bots
     SET tg_session_backup = $2,
         tg_session_backup_at = NOW()
     WHERE id = $1`,
    [botId, trimmed]
  );
}

export async function getTgSessionBackup(botId: string): Promise<TgSessionBackupRow | null> {
  if (!useDatabase()) return null;
  const pool = getPool();
  const { rows } = await pool.query<{
    tg_session_backup: string | null;
    tg_session_backup_at: Date | null;
  }>(
    `SELECT tg_session_backup, tg_session_backup_at
     FROM bots WHERE id = $1`,
    [botId]
  );
  const row = rows[0];
  const session = String(row?.tg_session_backup || "").trim();
  if (!session) return null;
  return {
    session,
    backedUpAt: row?.tg_session_backup_at || new Date()
  };
}

export async function clearTgSessionBackup(botId: string): Promise<void> {
  if (!useDatabase()) return;
  const pool = getPool();
  await pool.query(
    `UPDATE bots
     SET tg_session_backup = NULL,
         tg_session_backup_at = NULL
     WHERE id = $1`,
    [botId]
  );
}

export async function countTgSessionBackups(): Promise<number> {
  if (!useDatabase()) return 0;
  const pool = getPool();
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM bots WHERE tg_session_backup IS NOT NULL AND tg_session_backup <> ''`
  );
  return Number(rows[0]?.count || 0);
}
