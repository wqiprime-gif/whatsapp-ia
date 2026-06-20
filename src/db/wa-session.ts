import type pg from "pg";
import { getPool, useDatabase } from "./index.js";

export type WaSessionBackupRow = {
  data: Buffer;
  clientId: string;
  backedUpAt: Date;
};

export async function initWaSessionSchema(db: pg.Pool) {
  await db.query(`
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS wa_session_backup BYTEA;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS wa_session_backup_at TIMESTAMPTZ;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS wa_session_client_id TEXT;
  `);
}

export async function saveWaSessionBackup(
  botId: string,
  data: Buffer,
  clientId: string
): Promise<void> {
  if (!useDatabase()) return;
  const pool = getPool();
  await pool.query(
    `UPDATE bots
     SET wa_session_backup = $2,
         wa_session_backup_at = NOW(),
         wa_session_client_id = $3
     WHERE id = $1`,
    [botId, data, clientId]
  );
}

export async function getWaSessionBackup(botId: string): Promise<WaSessionBackupRow | null> {
  if (!useDatabase()) return null;
  const pool = getPool();
  const { rows } = await pool.query<{
    wa_session_backup: Buffer | null;
    wa_session_client_id: string | null;
    wa_session_backup_at: Date | null;
  }>(
    `SELECT wa_session_backup, wa_session_client_id, wa_session_backup_at
     FROM bots WHERE id = $1`,
    [botId]
  );
  const row = rows[0];
  if (!row?.wa_session_backup || row.wa_session_backup.length === 0) return null;
  return {
    data: row.wa_session_backup,
    clientId: row.wa_session_client_id || "",
    backedUpAt: row.wa_session_backup_at || new Date()
  };
}

export async function clearWaSessionBackup(botId: string): Promise<void> {
  if (!useDatabase()) return;
  const pool = getPool();
  await pool.query(
    `UPDATE bots
     SET wa_session_backup = NULL,
         wa_session_backup_at = NULL,
         wa_session_client_id = NULL
     WHERE id = $1`,
    [botId]
  );
}

export async function countWaSessionBackups(): Promise<number> {
  if (!useDatabase()) return 0;
  const pool = getPool();
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM bots WHERE wa_session_backup IS NOT NULL`
  );
  return Number(rows[0]?.count || 0);
}
