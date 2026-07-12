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

const EPHEMERAL_TITLES = new Set([
  "nenhum dispositivo",
  "gerando link",
  "copiado!",
  "selecione o mp4",
  "sem link",
  "limpo",
  "instalar app",
  "notificação local ok",
  "permissão bloqueada",
  "teste parcial",
  "push enviado!",
  "não gerou",
  "foto",
  "vídeo",
  "erro"
]);

/** Toasts de UI que não devem ficar no sino. */
export function isEphemeralPanelTitle(title: string, id?: string) {
  const tid = String(id || "");
  if (tid.startsWith("toast-")) return true;
  const t = String(title || "").trim().toLowerCase();
  if (!t) return true;
  if (EPHEMERAL_TITLES.has(t)) return true;
  if (t.startsWith("push:")) return true;
  if (t.startsWith("link pronto!")) return true;
  return false;
}

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

function dedupeItems(items: PanelNotification[]) {
  const out: PanelNotification[] = [];
  const seenId = new Set<string>();
  const seenKey = new Set<string>();
  for (const item of items) {
    if (!item || isEphemeralPanelTitle(item.title, item.id)) continue;
    if (seenId.has(item.id)) continue;
    const key = `${item.title}|${item.subtitle}`.toLowerCase();
    if (seenKey.has(key)) continue;
    seenId.add(item.id);
    seenKey.add(key);
    out.push(item);
  }
  return out;
}

export async function addPanelNotification(input: {
  userId: string;
  kind?: string;
  title: string;
  subtitle?: string;
  id?: string;
}): Promise<PanelNotification | null> {
  const title = input.title.trim() || "Notificação";
  if (isEphemeralPanelTitle(title, input.id)) return null;

  const item: PanelNotification = {
    id: input.id || `pn-${randomUUID()}`,
    userId: input.userId,
    kind: input.kind || "daily",
    title,
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
  store.items = dedupeItems(store.items).slice(0, 200);
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
      [userId, Math.max(limit * 3, 48)]
    );
    const mapped = rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      kind: String(r.kind || "daily"),
      title: String(r.title || ""),
      subtitle: String(r.subtitle || ""),
      at: new Date(r.created_at).toISOString()
    }));
    const clean = dedupeItems(mapped).slice(0, limit);
    const spamIds = mapped.filter((i) => isEphemeralPanelTitle(i.title, i.id)).map((i) => i.id);
    if (spamIds.length) {
      await getPool().query(`DELETE FROM panel_notifications WHERE id = ANY($1::text[])`, [spamIds]);
    }
    return clean;
  }

  const store = await loadFileStore();
  const before = store.items.length;
  store.items = dedupeItems(store.items.filter((i) => i.userId === userId)).concat(
    store.items.filter((i) => i.userId !== userId)
  );
  if (store.items.length !== before) await saveFileStore(store);
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
