import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import webpush from "web-push";
import { env } from "../config.js";
import { getPool, useDatabase } from "../db/index.js";

const subsFile = path.join(env.DATA_DIR, "push-subscriptions.json");

export type PushSubscriptionRecord = {
  id: string;
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
};

type FileStore = { subscriptions: PushSubscriptionRecord[] };

let vapidReady = false;

export function isWebPushConfigured() {
  return Boolean(env.VAPID_PUBLIC_KEY?.trim() && env.VAPID_PRIVATE_KEY?.trim());
}

export function getVapidPublicKey() {
  return env.VAPID_PUBLIC_KEY?.trim() || "";
}

function ensureVapid() {
  if (vapidReady || !isWebPushConfigured()) return false;
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY.trim(),
    env.VAPID_PRIVATE_KEY.trim()
  );
  vapidReady = true;
  return true;
}

async function loadFile(): Promise<FileStore> {
  try {
    const raw = await fs.readFile(subsFile, "utf8");
    return { subscriptions: JSON.parse(raw).subscriptions ?? [] };
  } catch {
    return { subscriptions: [] };
  }
}

async function saveFile(store: FileStore) {
  await fs.mkdir(env.DATA_DIR, { recursive: true });
  await fs.writeFile(subsFile, JSON.stringify(store, null, 2));
}

export async function initPushSubscriptionsSchema() {
  if (!useDatabase()) return;
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES panel_users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      keys JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
  `);
}

export async function savePushSubscription(
  userId: string,
  input: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  const record: PushSubscriptionRecord = {
    id: randomUUID(),
    userId,
    endpoint: input.endpoint,
    keys: input.keys,
    createdAt: new Date().toISOString()
  };

  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, keys, created_at)
       VALUES ($1,$2,$3,$4::jsonb,$5)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, keys = EXCLUDED.keys`,
      [record.id, userId, record.endpoint, JSON.stringify(record.keys), record.createdAt]
    );
    return;
  }

  const store = await loadFile();
  const idx = store.subscriptions.findIndex((s) => s.endpoint === record.endpoint);
  if (idx >= 0) store.subscriptions[idx] = record;
  else store.subscriptions.push(record);
  await saveFile(store);
}

async function listSubscriptionsForUser(userId: string): Promise<PushSubscriptionRecord[]> {
  if (useDatabase()) {
    const { rows } = await getPool().query<{ endpoint: string; keys: { p256dh: string; auth: string } }>(
      `SELECT endpoint, keys FROM push_subscriptions WHERE user_id = $1`,
      [userId]
    );
    return rows.map((r) => ({
      id: "",
      userId,
      endpoint: r.endpoint,
      keys: r.keys,
      createdAt: ""
    }));
  }
  const store = await loadFile();
  return store.subscriptions.filter((s) => s.userId === userId);
}

export async function sendPushToSubscription(
  sub: PushSubscriptionRecord,
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  if (!ensureVapid()) throw new Error("Web Push não configurado (VAPID).");
  await webpush.sendNotification(
    {
      endpoint: sub.endpoint,
      keys: sub.keys
    },
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
      tag: payload.tag || "onlychat"
    })
  );
}

export async function notifyUserPush(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  if (!ensureVapid()) return { sent: 0, failed: 0 };
  const subs = await listSubscriptionsForUser(userId);
  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await sendPushToSubscription(sub, payload);
      sent += 1;
    } catch (error) {
      failed += 1;
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        if (useDatabase()) {
          await getPool().query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [sub.endpoint]);
        } else {
          const store = await loadFile();
          store.subscriptions = store.subscriptions.filter((s) => s.endpoint !== sub.endpoint);
          await saveFile(store);
        }
      }
    }
  }
  return { sent, failed };
}

export async function notifyAllUsersPush(payload: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  if (!ensureVapid()) return { users: 0, sent: 0, failed: 0 };
  let userIds: string[] = [];
  if (useDatabase()) {
    const { rows } = await getPool().query<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM push_subscriptions`
    );
    userIds = rows.map((r) => String(r.user_id));
  } else {
    const store = await loadFile();
    userIds = [...new Set(store.subscriptions.map((s) => s.userId))];
  }
  let sent = 0;
  let failed = 0;
  for (const userId of userIds) {
    const result = await notifyUserPush(userId, payload);
    sent += result.sent;
    failed += result.failed;
  }
  return { users: userIds.length, sent, failed };
}

export async function sendTestPush(userId: string) {
  return notifyUserPush(userId, {
    title: "OnlyChat — teste OK",
    body: "Notificações no celular funcionando!",
    url: "/perfil",
    tag: "onlychat-test"
  });
}
