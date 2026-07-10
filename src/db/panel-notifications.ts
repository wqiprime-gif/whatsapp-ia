import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config.js";
import { getPool, useDatabase } from "./index.js";

export type PanelNotification = {
  id: string;
  userId: string;
  kind: string;
  title: string;
  subtitle: string;
  at: string;
};

type FileStore = { items: PanelNotification[] };

const storeFile = path.join(env.DATA_DIR, "panel-notifications.json");

async function loadFileStore(): Promise<FileStore> {
  try {
    const raw = await fs.readFile(storeFile, "utf8");
    const parsed = JSON.parse(raw) as FileStore;
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
}

async function saveFileStore(store: FileStore) {
  await fs.mkdir(path.dirname(storeFile), { recursive: true });
  await fs.writeFile(storeFile, JSON.stringify(store, null, 2));
}

export async function addPanelNotification(input: {
  userId: string;
  kind?: string;
  title: string;
  subtitle?: string;
  id?: string;
}): Promise<PanelNotification> {
  const item: PanelNotification = {
    id: input.id || `pn-${randomUUID()}`,
    userId: input.userId,
    kind: input.kind || "daily",
    title: input.title.trim() || "Notificação",
    subtitle: (input.subtitle || "").trim(),
    at: new Date().toISOString()
  };

  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO panel_notifications (id, user_id, kind, title, subtitle, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [item.id, item.userId, item.kind, item.title, item.subtitle]
    );
    return item;
  }

  const store = await loadFileStore();
  store.items.unshift(item);
  store.items = store.items.slice(0, 200);
  await saveFileStore(store);
  return item;
}

export async function listPanelNotifications(userId: string, limit = 24): Promise<PanelNotification[]> {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT id, user_id, kind, title, subtitle, created_at
       FROM panel_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      kind: String(r.kind || "daily"),
      title: String(r.title || ""),
      subtitle: String(r.subtitle || ""),
      at: new Date(r.created_at).toISOString()
    }));
  }

  const store = await loadFileStore();
  return store.items.filter((i) => i.userId === userId).slice(0, limit);
}

export async function clearPanelNotifications(userId: string) {
  if (useDatabase()) {
    await getPool().query(`DELETE FROM panel_notifications WHERE user_id = $1`, [userId]);
    return;
  }
  const store = await loadFileStore();
  store.items = store.items.filter((i) => i.userId !== userId);
  await saveFileStore(store);
}
