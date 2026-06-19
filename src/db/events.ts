import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config.js";
import { getPool, useDatabase } from "./index.js";

const eventsFile = path.join(env.DATA_DIR, "events.json");

type Store = {
  leads: Lead[];
  messages: ConversationMessage[];
  receipts: Receipt[];
  sales: Sale[];
  products: Product[];
};

export type Lead = {
  id: string;
  botId: string;
  chatId: number;
  username?: string;
  displayName?: string;
  source: string;
  createdAt: string;
  lastMessageAt: string;
};

export type ConversationMessage = {
  id: string;
  botId: string;
  chatId: number;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type Receipt = {
  id: string;
  botId: string;
  chatId: number;
  fileUrl?: string;
  fileType?: string;
  paid: boolean;
  confidence: number;
  reason: string;
  createdAt: string;
};

export type Sale = {
  id: string;
  botId: string;
  chatId: number;
  productName: string;
  amountCents: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
};

export type Product = {
  id: string;
  botId: string;
  name: string;
  priceCents: number;
  active: boolean;
  allowHalfPrice: boolean;
  halfPricePercent: number;
  createdAt: string;
  botName?: string;
};

const emptyStore = (): Store => ({
  leads: [],
  messages: [],
  receipts: [],
  sales: [],
  products: []
});

async function loadFileStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(eventsFile, "utf8");
    return { ...emptyStore(), ...JSON.parse(raw) };
  } catch {
    return emptyStore();
  }
}

async function saveFileStore(store: Store) {
  await fs.mkdir(env.DATA_DIR, { recursive: true });
  await fs.writeFile(eventsFile, JSON.stringify(store, null, 2));
}

export async function initEventsSchema() {
  if (!useDatabase()) return;

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bot_id UUID NOT NULL,
      chat_id BIGINT NOT NULL,
      username TEXT,
      display_name TEXT,
      source TEXT NOT NULL DEFAULT 'unknown',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(bot_id, chat_id)
    );

    ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'unknown';

    CREATE TABLE IF NOT EXISTS conversation_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bot_id UUID NOT NULL,
      chat_id BIGINT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bot_id UUID NOT NULL,
      chat_id BIGINT NOT NULL,
      file_url TEXT,
      file_type TEXT,
      paid BOOLEAN NOT NULL DEFAULT false,
      confidence NUMERIC NOT NULL DEFAULT 0,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bot_id UUID NOT NULL,
      chat_id BIGINT NOT NULL,
      product_name TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'pix',
      status TEXT NOT NULL DEFAULT 'approved',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bot_id UUID NOT NULL,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      allow_half_price BOOLEAN NOT NULL DEFAULT false,
      half_price_percent INTEGER NOT NULL DEFAULT 50,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_half_price BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS half_price_percent INTEGER NOT NULL DEFAULT 50;

    ALTER TABLE bots ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pix';
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS laranjinha_api_key_encrypted TEXT;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS product_name TEXT NOT NULL DEFAULT 'VIP';
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS product_price_cents INTEGER NOT NULL DEFAULT 4990;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS telegram_group_link TEXT NOT NULL DEFAULT '';
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS backup_token TEXT;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS gift_prompt TEXT NOT NULL DEFAULT '';
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS gift_items JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS wa_port INTEGER;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS wa_api_provider TEXT NOT NULL DEFAULT 'whatsapp_web';
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS proxy_enabled BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS proxy_url_encrypted TEXT;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS meta_access_token_encrypted TEXT;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS meta_verify_token TEXT NOT NULL DEFAULT '';
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS follow_up_enabled BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS follow_up_after_minutes INTEGER NOT NULL DEFAULT 10;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS follow_up_max_per_lead INTEGER NOT NULL DEFAULT 2;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS callhot_enabled BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS callhot_base_url TEXT NOT NULL DEFAULT '';
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS callhot_api_secret_encrypted TEXT;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS video_call_video_url TEXT NOT NULL DEFAULT '';
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS video_call_price_cents INTEGER NOT NULL DEFAULT 1500;
  `);
}

export async function upsertLead(input: {
  botId: string;
  chatId: number;
  username?: string;
  displayName?: string;
  source?: string;
}) {
  const source = input.source?.trim() || undefined;

  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO leads (bot_id, chat_id, username, display_name, source)
       VALUES ($1,$2,$3,$4,COALESCE($5, 'unknown'))
       ON CONFLICT (bot_id, chat_id) DO UPDATE SET
         username = COALESCE(EXCLUDED.username, leads.username),
         display_name = COALESCE(EXCLUDED.display_name, leads.display_name),
         source = CASE
           WHEN leads.source IS NULL OR leads.source = 'unknown' THEN COALESCE(EXCLUDED.source, leads.source)
           ELSE leads.source
         END,
         last_message_at = NOW()`,
      [input.botId, input.chatId, input.username ?? null, input.displayName ?? null, source ?? null]
    );
    return;
  }

  const store = await loadFileStore();
  const existing = store.leads.find((l) => l.botId === input.botId && l.chatId === input.chatId);
  const now = new Date().toISOString();
  if (existing) {
    existing.lastMessageAt = now;
    if (input.username) existing.username = input.username;
    if (input.displayName) existing.displayName = input.displayName;
    if (source && (!existing.source || existing.source === "unknown")) existing.source = source;
  } else {
    store.leads.push({
      id: randomUUID(),
      botId: input.botId,
      chatId: input.chatId,
      username: input.username,
      displayName: input.displayName,
      source: source ?? "unknown",
      createdAt: now,
      lastMessageAt: now
    });
  }
  await saveFileStore(store);
}

export async function setLeadSource(input: { botId: string; chatId: number; source: string }) {
  if (useDatabase()) {
    await getPool().query(
      `UPDATE leads SET source = $3
       WHERE bot_id = $1 AND chat_id = $2
         AND (source IS NULL OR source = 'unknown')`,
      [input.botId, input.chatId, input.source]
    );
    return;
  }
  const store = await loadFileStore();
  const lead = store.leads.find((l) => l.botId === input.botId && l.chatId === input.chatId);
  if (lead && (!lead.source || lead.source === "unknown")) lead.source = input.source;
  await saveFileStore(store);
}

export type LeadSourceStat = { source: string; count: number };

export async function leadSourcesStats(userId?: string, limit = 12): Promise<LeadSourceStat[]> {
  const botIds = await botIdsForUser(userId);
  if (userId && botIds && botIds.length === 0) return [];

  if (useDatabase()) {
    const { rows } = botIds
      ? await getPool().query<{ source: string; count: string }>(
          `SELECT COALESCE(NULLIF(source, ''), 'unknown') AS source, COUNT(*)::text AS count
           FROM leads WHERE bot_id = ANY($1::uuid[])
           GROUP BY 1 ORDER BY count DESC LIMIT $2`,
          [botIds, limit]
        )
      : await getPool().query<{ source: string; count: string }>(
          `SELECT COALESCE(NULLIF(source, ''), 'unknown') AS source, COUNT(*)::text AS count
           FROM leads GROUP BY 1 ORDER BY count DESC LIMIT $1`,
          [limit]
        );
    return rows.map((r) => ({ source: r.source, count: Number(r.count) }));
  }

  const store = await loadFileStore();
  const map = new Map<string, number>();
  for (const l of store.leads) {
    if (botIds && !botIds.includes(l.botId)) continue;
    const s = l.source || "unknown";
    map.set(s, (map.get(s) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function logMessage(input: {
  botId: string;
  chatId: number;
  role: "user" | "assistant" | "system";
  content: string;
}) {
  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO conversation_messages (bot_id, chat_id, role, content) VALUES ($1,$2,$3,$4)`,
      [input.botId, input.chatId, input.role, input.content.slice(0, 8000)]
    );
    return;
  }

  const store = await loadFileStore();
  store.messages.push({
    id: randomUUID(),
    botId: input.botId,
    chatId: input.chatId,
    role: input.role,
    content: input.content.slice(0, 8000),
    createdAt: new Date().toISOString()
  });
  if (store.messages.length > 5000) store.messages = store.messages.slice(-5000);
  await saveFileStore(store);
}

export async function logReceipt(input: {
  botId: string;
  chatId: number;
  fileUrl?: string;
  fileType?: string;
  paid: boolean;
  confidence: number;
  reason: string;
}) {
  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO receipts (bot_id, chat_id, file_url, file_type, paid, confidence, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        input.botId,
        input.chatId,
        input.fileUrl ?? null,
        input.fileType ?? null,
        input.paid,
        input.confidence,
        input.reason
      ]
    );
    return;
  }

  const store = await loadFileStore();
  store.receipts.unshift({
    id: randomUUID(),
    ...input,
    createdAt: new Date().toISOString()
  });
  await saveFileStore(store);
}

export async function logSale(input: {
  botId: string;
  chatId: number;
  productName: string;
  amountCents: number;
  paymentMethod: string;
}) {
  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO sales (bot_id, chat_id, product_name, amount_cents, payment_method)
       VALUES ($1,$2,$3,$4,$5)`,
      [input.botId, input.chatId, input.productName, input.amountCents, input.paymentMethod]
    );
    return;
  }

  const store = await loadFileStore();
  store.sales.unshift({
    id: randomUUID(),
    botId: input.botId,
    chatId: input.chatId,
    productName: input.productName,
    amountCents: input.amountCents,
    paymentMethod: input.paymentMethod,
    status: "approved",
    createdAt: new Date().toISOString()
  });
  await saveFileStore(store);
}

export async function listLeadsWithoutPurchase(botIds: string[]) {
  if (botIds.length === 0) return [];
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT l.bot_id, l.chat_id, l.username, l.display_name FROM leads l
       WHERE l.bot_id = ANY($1::uuid[])
       AND NOT EXISTS (
         SELECT 1 FROM sales s WHERE s.bot_id = l.bot_id AND s.chat_id = l.chat_id
       )
       ORDER BY l.last_message_at DESC`,
      [botIds]
    );
    return rows.map((r) => ({
      botId: String(r.bot_id),
      chatId: Number(r.chat_id),
      username: r.username as string | undefined,
      displayName: r.display_name as string | undefined
    }));
  }

  const store = await loadFileStore();
  const set = new Set(botIds);
  const paid = new Set(store.sales.map((s) => `${s.botId}:${s.chatId}`));
  return store.leads
    .filter((l) => set.has(l.botId) && !paid.has(`${l.botId}:${l.chatId}`))
    .map((l) => ({
      botId: l.botId,
      chatId: l.chatId,
      username: l.username,
      displayName: l.displayName
    }));
}

export async function listLeadsByBots(botIds: string[]) {
  if (botIds.length === 0) return [];
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT bot_id, chat_id, username, display_name FROM leads
       WHERE bot_id = ANY($1::uuid[]) ORDER BY last_message_at DESC`,
      [botIds]
    );
    return rows.map((r) => ({
      botId: String(r.bot_id),
      chatId: Number(r.chat_id),
      username: r.username as string | undefined,
      displayName: r.display_name as string | undefined
    }));
  }

  const store = await loadFileStore();
  const set = new Set(botIds);
  return store.leads
    .filter((l) => set.has(l.botId))
    .map((l) => ({
      botId: l.botId,
      chatId: l.chatId,
      username: l.username,
      displayName: l.displayName
    }));
}

export async function listLeadsWithoutPurchaseForBot(botId: string) {
  return listLeadsWithoutPurchase([botId]);
}

export async function listLeadsByBot(botId: string) {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT chat_id, username, display_name FROM leads WHERE bot_id = $1 ORDER BY last_message_at DESC`,
      [botId]
    );
    return rows.map((r) => ({
      chatId: Number(r.chat_id),
      username: r.username as string | undefined,
      displayName: r.display_name as string | undefined
    }));
  }

  const store = await loadFileStore();
  return store.leads
    .filter((l) => l.botId === botId)
    .map((l) => ({
      chatId: l.chatId,
      username: l.username,
      displayName: l.displayName
    }));
}

export async function listLeads(limit = 100) {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT l.*, b.name AS bot_name FROM leads l
       LEFT JOIN bots b ON b.id = l.bot_id
       ORDER BY l.last_message_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }
  const store = await loadFileStore();
  return store.leads.slice(0, limit);
}

export async function listConversations(limit = 80) {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT m.*, b.name AS bot_name FROM conversation_messages m
       LEFT JOIN bots b ON b.id = m.bot_id
       ORDER BY m.created_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }
  const store = await loadFileStore();
  return store.messages.slice(-limit).reverse();
}

export type ConversationThread = {
  botId: string;
  botName: string;
  chatId: number;
  displayName: string;
  username?: string;
  source: string;
  lastMessageAt: string;
  lastPreview: string;
  lastRole: string;
  messageCount: number;
};

export async function listConversationThreads(botIds: string[] | null, limit = 80) {
  if (botIds && botIds.length === 0) return [];

  if (useDatabase()) {
    const params: unknown[] = [limit];
    const scope = botIds ? " AND l.bot_id = ANY($2::uuid[])" : "";
    if (botIds) params.push(botIds);

    const { rows } = await getPool().query<{
      bot_id: string;
      bot_name: string;
      chat_id: string;
      display_name: string | null;
      username: string | null;
      source: string;
      last_message_at: string;
      last_preview: string | null;
      last_role: string | null;
      message_count: string;
    }>(
      `SELECT l.bot_id, COALESCE(b.name, 'Bot') AS bot_name, l.chat_id,
              l.display_name, l.username, COALESCE(l.source, 'unknown') AS source,
              l.last_message_at,
              lm.content AS last_preview, lm.role AS last_role,
              (SELECT COUNT(*)::text FROM conversation_messages cm
               WHERE cm.bot_id = l.bot_id AND cm.chat_id = l.chat_id) AS message_count
       FROM leads l
       LEFT JOIN bots b ON b.id = l.bot_id
       LEFT JOIN LATERAL (
         SELECT content, role, created_at FROM conversation_messages
         WHERE bot_id = l.bot_id AND chat_id = l.chat_id
         ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       WHERE 1=1${scope}
       ORDER BY COALESCE(lm.created_at, l.last_message_at) DESC
       LIMIT $1`,
      params
    );

    return rows.map((r) => ({
      botId: r.bot_id,
      botName: r.bot_name,
      chatId: Number(r.chat_id),
      displayName: r.display_name || r.username || `Lead ${r.chat_id}`,
      username: r.username ?? undefined,
      source: r.source,
      lastMessageAt: new Date(r.last_message_at).toISOString(),
      lastPreview: String(r.last_preview ?? "").slice(0, 120),
      lastRole: r.last_role ?? "user",
      messageCount: Number(r.message_count ?? 0)
    }));
  }

  const store = await loadFileStore();
  const bots = await (await import("../bots.js")).loadBots();
  const botName = (id: string) => bots.find((b) => b.id === id)?.name ?? "Bot";
  const threads: ConversationThread[] = [];

  for (const lead of store.leads) {
    if (botIds && !botIds.includes(lead.botId)) continue;
    const msgs = store.messages
      .filter((m) => m.botId === lead.botId && m.chatId === lead.chatId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = msgs[msgs.length - 1];
    threads.push({
      botId: lead.botId,
      botName: botName(lead.botId),
      chatId: lead.chatId,
      displayName: lead.displayName || lead.username || `Lead ${lead.chatId}`,
      username: lead.username,
      source: lead.source || "unknown",
      lastMessageAt: last?.createdAt ?? lead.lastMessageAt,
      lastPreview: (last?.content ?? "").slice(0, 120),
      lastRole: last?.role ?? "user",
      messageCount: msgs.length
    });
  }

  return threads
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
    .slice(0, limit);
}

export async function getConversationMessages(botId: string, chatId: number, limit = 200) {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT role, content, created_at FROM conversation_messages
       WHERE bot_id = $1 AND chat_id = $2
       ORDER BY created_at ASC LIMIT $3`,
      [botId, chatId, limit]
    );
    return rows.map((r) => ({
      role: r.role as "user" | "assistant" | "system",
      content: String(r.content),
      createdAt: new Date(r.created_at as string).toISOString()
    }));
  }

  const store = await loadFileStore();
  return store.messages
    .filter((m) => m.botId === botId && m.chatId === chatId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-limit)
    .map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt }));
}

export async function listReceipts(limit = 50) {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT r.*, b.name AS bot_name FROM receipts r
       LEFT JOIN bots b ON b.id = r.bot_id
       ORDER BY r.created_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }
  const store = await loadFileStore();
  return store.receipts.slice(0, limit);
}

export async function listSales(limit = 50, userId?: string) {
  const botIds = await botIdsForUser(userId);
  if (userId && botIds && botIds.length === 0) return [];

  if (useDatabase()) {
    const { rows } = botIds
      ? await getPool().query(
          `SELECT s.*, b.name AS bot_name FROM sales s
           LEFT JOIN bots b ON b.id = s.bot_id
           WHERE s.bot_id = ANY($2::uuid[])
           ORDER BY s.created_at DESC LIMIT $1`,
          [limit, botIds]
        )
      : await getPool().query(
          `SELECT s.*, b.name AS bot_name FROM sales s
           LEFT JOIN bots b ON b.id = s.bot_id
           ORDER BY s.created_at DESC LIMIT $1`,
          [limit]
        );
    return rows;
  }
  const store = await loadFileStore();
  const sales = botIds ? store.sales.filter((s) => botIds.includes(s.botId)) : store.sales;
  return sales.slice(0, limit);
}

export async function salesByDay(days = 7, userId?: string) {
  const botIds = await botIdsForUser(userId);
  if (userId && botIds && botIds.length === 0) return [];

  if (useDatabase()) {
    const { rows } = botIds
      ? await getPool().query<{ day: string; total: string }>(
          `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                  COALESCE(SUM(amount_cents), 0)::text AS total
           FROM sales
           WHERE created_at >= NOW() - ($1::int || ' days')::interval
             AND bot_id = ANY($2::uuid[])
           GROUP BY 1 ORDER BY 1`,
          [days, botIds]
        )
      : await getPool().query<{ day: string; total: string }>(
          `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                  COALESCE(SUM(amount_cents), 0)::text AS total
           FROM sales
           WHERE created_at >= NOW() - ($1::int || ' days')::interval
           GROUP BY 1 ORDER BY 1`,
          [days]
        );
    return rows.map((r) => ({ day: r.day, totalCents: Number(r.total) }));
  }

  const store = await loadFileStore();
  const map = new Map<string, number>();
  const cutoff = Date.now() - days * 86400000;
  const salesRows = botIds ? store.sales.filter((s) => botIds.includes(s.botId)) : store.sales;
  for (const s of salesRows) {
    if (new Date(s.createdAt).getTime() < cutoff) continue;
    const day = s.createdAt.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + s.amountCents);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, totalCents]) => ({ day, totalCents }));
}

export async function messagesByDay(days = 7, userId?: string) {
  const botIds = await botIdsForUser(userId);
  if (userId && botIds && botIds.length === 0) return [];

  if (useDatabase()) {
    const { rows } = botIds
      ? await getPool().query<{ day: string; total: string }>(
          `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                  COUNT(*)::text AS total
           FROM conversation_messages
           WHERE created_at >= NOW() - ($1::int || ' days')::interval
             AND bot_id = ANY($2::uuid[])
           GROUP BY 1 ORDER BY 1`,
          [days, botIds]
        )
      : await getPool().query<{ day: string; total: string }>(
          `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                  COUNT(*)::text AS total
           FROM conversation_messages
           WHERE created_at >= NOW() - ($1::int || ' days')::interval
           GROUP BY 1 ORDER BY 1`,
          [days]
        );
    return rows.map((r) => ({ day: r.day, count: Number(r.total) }));
  }

  const store = await loadFileStore();
  const map = new Map<string, number>();
  const cutoff = Date.now() - days * 86400000;
  const rows = botIds
    ? store.messages.filter((m) => botIds.includes(m.botId))
    : store.messages;
  for (const m of rows) {
    if (new Date(m.createdAt).getTime() < cutoff) continue;
    const day = m.createdAt.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count }));
}

export type ActivityItem = {
  id: string;
  type: "sale" | "lead" | "receipt";
  title: string;
  subtitle: string;
  at: string;
};

export type BotSalesRank = {
  botId: string;
  name: string;
  salesCount: number;
  totalCents: number;
};

export type UserSalesRank = {
  userId: string;
  displayName: string;
  email: string;
  salesCount: number;
  totalCents: number;
};

function formatSaleSubtitle(productName: string, amountCents: number, botName: string) {
  const reais = (amountCents / 100).toFixed(2).replace(".", ",");
  return `${productName} · R$ ${reais} · ${botName || "Bot"}`;
}

export async function listRecentActivity(limit = 8, userId?: string): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];
  const botIds = await botIdsForUser(userId);
  if (userId && botIds && botIds.length === 0) return [];

  if (useDatabase()) {
    const db = getPool();
    const scope = botIds ? " WHERE s.bot_id = ANY($2::uuid[])" : "";
    const scopeL = botIds ? " WHERE l.bot_id = ANY($2::uuid[])" : "";
    const scopeR = botIds ? " AND r.bot_id = ANY($2::uuid[])" : "";
    const params = botIds ? [limit, botIds] : [limit];
    const [sales, leads, receipts] = await Promise.all([
      db.query<{
        id: string;
        amount_cents: number;
        product_name: string;
        created_at: string;
        bot_name: string;
      }>(
        `SELECT s.id, s.amount_cents, s.product_name, s.created_at, COALESCE(b.name, 'Bot') AS bot_name
         FROM sales s LEFT JOIN bots b ON b.id = s.bot_id${scope}
         ORDER BY s.created_at DESC LIMIT $1`,
        params
      ),
      db.query<{
        id: string;
        display_name: string | null;
        username: string | null;
        last_message_at: string;
        bot_name: string;
      }>(
        `SELECT l.id, l.display_name, l.username, l.last_message_at, COALESCE(b.name, 'Bot') AS bot_name
         FROM leads l LEFT JOIN bots b ON b.id = l.bot_id${scopeL}
         ORDER BY l.last_message_at DESC LIMIT $1`,
        params
      ),
      db.query<{ id: string; created_at: string; bot_name: string }>(
        `SELECT r.id, r.created_at, COALESCE(b.name, 'Bot') AS bot_name
         FROM receipts r LEFT JOIN bots b ON b.id = r.bot_id
         WHERE r.paid = true${scopeR} ORDER BY r.created_at DESC LIMIT $1`,
        params
      )
    ]);

    for (const s of sales.rows) {
      items.push({
        id: `sale-${s.id}`,
        type: "sale",
        title: "Venda confirmada",
        subtitle: formatSaleSubtitle(s.product_name, s.amount_cents, s.bot_name),
        at: new Date(s.created_at).toISOString()
      });
    }
    for (const l of leads.rows) {
      const who = l.display_name || (l.username ? `@${l.username}` : "Novo contato");
      items.push({
        id: `lead-${l.id}`,
        type: "lead",
        title: "Novo lead",
        subtitle: `${who} · ${l.bot_name}`,
        at: new Date(l.last_message_at).toISOString()
      });
    }
    for (const r of receipts.rows) {
      items.push({
        id: `receipt-${r.id}`,
        type: "receipt",
        title: "Comprovante aprovado",
        subtitle: `Pix validado · ${r.bot_name}`,
        at: new Date(r.created_at).toISOString()
      });
    }
  } else {
    const store = await loadFileStore();
    const bots = await (await import("../bots.js")).loadBots();
    const botName = (id: string) => bots.find((b) => b.id === id)?.name ?? "Bot";

    for (const s of store.sales.slice(0, limit)) {
      items.push({
        id: `sale-${s.id}`,
        type: "sale",
        title: "Venda confirmada",
        subtitle: formatSaleSubtitle(s.productName, s.amountCents, botName(s.botId)),
        at: s.createdAt
      });
    }
    for (const l of [...store.leads].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)).slice(0, limit)) {
      const who = l.displayName || (l.username ? `@${l.username}` : "Novo contato");
      items.push({
        id: `lead-${l.id}`,
        type: "lead",
        title: "Novo lead",
        subtitle: `${who} · ${botName(l.botId)}`,
        at: l.lastMessageAt
      });
    }
    for (const r of store.receipts.filter((x) => x.paid).slice(0, limit)) {
      items.push({
        id: `receipt-${r.id}`,
        type: "receipt",
        title: "Comprovante aprovado",
        subtitle: `Pix validado · ${botName(r.botId)}`,
        at: r.createdAt
      });
    }
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items.slice(0, limit);
}

export async function salesRankingByBot(limit = 5, userId?: string): Promise<BotSalesRank[]> {
  if (useDatabase()) {
    const { rows } = userId
      ? await getPool().query<{
          bot_id: string;
          name: string;
          sales_count: number;
          total_cents: number;
        }>(
          `SELECT b.id AS bot_id, b.name,
                  COUNT(s.id)::int AS sales_count,
                  COALESCE(SUM(s.amount_cents), 0)::int AS total_cents
           FROM bots b
           INNER JOIN sales s ON s.bot_id = b.id
           WHERE b.user_id = $2
           GROUP BY b.id, b.name
           ORDER BY total_cents DESC, sales_count DESC
           LIMIT $1`,
          [limit, userId]
        )
      : await getPool().query<{
          bot_id: string;
          name: string;
          sales_count: number;
          total_cents: number;
        }>(
          `SELECT b.id AS bot_id, b.name,
                  COUNT(s.id)::int AS sales_count,
                  COALESCE(SUM(s.amount_cents), 0)::int AS total_cents
           FROM bots b
           INNER JOIN sales s ON s.bot_id = b.id
           GROUP BY b.id, b.name
           ORDER BY total_cents DESC, sales_count DESC
           LIMIT $1`,
          [limit]
        );
    return rows.map((r) => ({
      botId: r.bot_id,
      name: r.name,
      salesCount: r.sales_count,
      totalCents: r.total_cents
    }));
  }

  const store = await loadFileStore();
  const bots = await (await import("../bots.js")).loadBots(userId);
  const map = new Map<string, BotSalesRank>();
  const allowed = new Set(bots.map((b) => b.id));

  for (const s of store.sales.filter((x) => !userId || allowed.has(x.botId))) {
    const cur = map.get(s.botId) ?? {
      botId: s.botId,
      name: bots.find((b) => b.id === s.botId)?.name ?? "Bot",
      salesCount: 0,
      totalCents: 0
    };
    cur.salesCount += 1;
    cur.totalCents += s.amountCents;
    map.set(s.botId, cur);
  }

  return [...map.values()]
    .sort((a, b) => b.totalCents - a.totalCents || b.salesCount - a.salesCount)
    .slice(0, limit);
}

function playerTier(totalCents: number) {
  const v = totalCents / 100;
  if (v >= 100_000) return "ABYSSAL PREDATOR";
  if (v >= 50_000) return "ABYSSAL BARON";
  if (v >= 10_000) return "SHARK HUNTER";
  if (v >= 1_000) return "RISING WAVE";
  return "STARTER";
}

function playerDisplayName(email: string, name?: string) {
  const trimmed = name?.trim();
  if (trimmed && !trimmed.startsWith("@")) return trimmed;
  const local = email.split("@")[0] || "player";
  return `@${local}`;
}

export async function salesRankingByUser(limit = 5): Promise<UserSalesRank[]> {
  if (useDatabase()) {
    const { rows } = await getPool().query<{
      user_id: string;
      email: string;
      name: string;
      sales_count: number;
      total_cents: number;
    }>(
      `SELECT u.id AS user_id, u.email, u.name,
              COUNT(s.id)::int AS sales_count,
              COALESCE(SUM(s.amount_cents), 0)::int AS total_cents
       FROM panel_users u
       INNER JOIN bots b ON b.user_id = u.id
       INNER JOIN sales s ON s.bot_id = b.id
       GROUP BY u.id, u.email, u.name
       ORDER BY total_cents DESC, sales_count DESC
       LIMIT $1`,
      [limit]
    );
    return rows.map((r) => ({
      userId: r.user_id,
      email: r.email,
      displayName: playerDisplayName(r.email, r.name),
      salesCount: r.sales_count,
      totalCents: r.total_cents
    }));
  }

  const store = await loadFileStore();
  const bots = await (await import("../bots.js")).loadBots();
  const usersFile = path.join(env.DATA_DIR, "users.json");
  let users: { id: string; email: string; name: string }[] = [];
  try {
    users = JSON.parse(await fs.readFile(usersFile, "utf8")) as { id: string; email: string; name: string }[];
  } catch {
    users = [];
  }
  const userById = new Map(users.map((u) => [u.id, u]));
  const botToUser = new Map(bots.map((b) => [b.id, b.userId ?? ""]));
  const map = new Map<string, UserSalesRank>();

  for (const s of store.sales) {
    const uid = botToUser.get(s.botId);
    if (!uid) continue;
    const user = userById.get(uid);
    const email = user?.email ?? "player@local";
    const cur = map.get(uid) ?? {
      userId: uid,
      email,
      displayName: playerDisplayName(email, user?.name),
      salesCount: 0,
      totalCents: 0
    };
    cur.salesCount += 1;
    cur.totalCents += s.amountCents;
    map.set(uid, cur);
  }

  return [...map.values()]
    .sort((a, b) => b.totalCents - a.totalCents || b.salesCount - a.salesCount)
    .slice(0, limit);
}

export { playerTier };

export async function getLatestSale(userId?: string) {
  const sales = await listSales(1, userId);
  if (sales.length === 0) return null;
  const s = sales[0] as Record<string, unknown>;
  const id = String(s.id);
  const amountCents = Number(s.amount_cents ?? s.amountCents ?? 0);
  const productName = String(s.product_name ?? s.productName ?? "Produto");
  const botName = String(s.bot_name ?? "Bot");
  const at = String(s.created_at ?? s.createdAt ?? new Date().toISOString());
  return {
    id,
    amountCents,
    productName,
    botName,
    subtitle: formatSaleSubtitle(productName, amountCents, botName),
    at
  };
}

async function botIdsForUser(userId?: string) {
  if (!userId) return null;
  const { loadBots } = await import("../bots.js");
  return (await loadBots(userId)).map((b) => b.id);
}

export async function dashboardStats(userId?: string) {
  const botIds = await botIdsForUser(userId);
  if (userId && botIds && botIds.length === 0) {
    return { leads: 0, salesTotalCents: 0, salesCount: 0, receiptsApproved: 0, messagesToday: 0 };
  }

  if (useDatabase()) {
    const db = getPool();
    const scopeWhere = botIds ? " WHERE bot_id = ANY($1::uuid[])" : "";
    const scopeAnd = botIds ? " AND bot_id = ANY($1::uuid[])" : "";
    const params = botIds ? [botIds] : [];
    const [leads, sales, receipts, messages] = await Promise.all([
      db.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM leads${scopeWhere}`, params),
      db.query<{ total: string; count: string }>(
        `SELECT COALESCE(SUM(amount_cents),0)::text AS total, COUNT(*)::text AS count FROM sales${scopeWhere}`,
        params
      ),
      db.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM receipts WHERE paid = true${scopeAnd}`,
        params
      ),
      db.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM conversation_messages WHERE created_at >= NOW() - interval '1 day'${scopeAnd}`,
        params
      )
    ]);
    return {
      leads: Number(leads.rows[0]?.c ?? 0),
      salesTotalCents: Number(sales.rows[0]?.total ?? 0),
      salesCount: Number(sales.rows[0]?.count ?? 0),
      receiptsApproved: Number(receipts.rows[0]?.c ?? 0),
      messagesToday: Number(messages.rows[0]?.c ?? 0)
    };
  }

  const store = await loadFileStore();
  const today = new Date().toISOString().slice(0, 10);
  const inScope = <T extends { botId: string }>(rows: T[]) =>
    botIds ? rows.filter((r) => botIds.includes(r.botId)) : rows;
  const leads = inScope(store.leads);
  const sales = inScope(store.sales);
  const receipts = inScope(store.receipts);
  const messages = inScope(store.messages);
  return {
    leads: leads.length,
    salesTotalCents: sales.reduce((s, x) => s + x.amountCents, 0),
    salesCount: sales.length,
    receiptsApproved: receipts.filter((r) => r.paid).length,
    messagesToday: messages.filter((m) => m.createdAt.startsWith(today)).length
  };
}

export async function syncAllProductsFromBots(bots: { id: string; prompt: string }[]) {
  let total = 0;
  for (const bot of bots) {
    total += await syncProductsFromPrompt(bot.id, bot.prompt);
  }
  return total;
}

export async function syncProductsFromPrompt(botId: string, prompt: string) {
  const { parseProductsFromPrompt } = await import("../lib/parse-prompt-products.js");
  const raw = parseProductsFromPrompt(prompt);
  const byName = new Map<string, (typeof raw)[0]>();
  for (const item of raw) {
    const key = item.name.toLowerCase().trim();
    if (!byName.has(key)) byName.set(key, item);
  }
  const items = [...byName.values()];
  if (items.length === 0) return 0;

  if (useDatabase()) {
    await getPool().query(`DELETE FROM products WHERE bot_id = $1`, [botId]);
    for (const item of items) {
      await getPool().query(
        `INSERT INTO products (bot_id, name, price_cents, allow_half_price, half_price_percent) VALUES ($1,$2,$3,true,50)`,
        [botId, item.name, item.priceCents]
      );
    }
    return items.length;
  }

  const store = await loadFileStore();
  store.products = store.products.filter((p) => p.botId !== botId);
  for (const item of items) {
    store.products.push({
      id: randomUUID(),
      botId,
      name: item.name,
      priceCents: item.priceCents,
      active: true,
      allowHalfPrice: true,
      halfPricePercent: 50,
      createdAt: new Date().toISOString()
    });
  }
  await saveFileStore(store);
  return items.length;
}

export async function listProducts(botId?: string): Promise<Product[]> {
  if (useDatabase()) {
    const { rows } = botId
      ? await getPool().query(
          `SELECT p.*, b.name AS bot_name FROM products p LEFT JOIN bots b ON b.id = p.bot_id
           WHERE p.bot_id = $1 ORDER BY p.created_at DESC`,
          [botId]
        )
      : await getPool().query(
          `SELECT p.*, b.name AS bot_name FROM products p LEFT JOIN bots b ON b.id = p.bot_id ORDER BY p.created_at DESC`
        );
    return rows.map((r) => ({
      ...rowToProduct(r as Record<string, unknown>),
      botName: r.bot_name ? String(r.bot_name) : undefined
    }));
  }
  const store = await loadFileStore();
  const list = botId ? store.products.filter((p) => p.botId === botId) : store.products;
  return list.map((p) => ({
    ...p,
    allowHalfPrice: p.allowHalfPrice ?? false,
    halfPricePercent: p.halfPricePercent ?? 50
  }));
}

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    botId: String(row.bot_id ?? row.botId),
    name: String(row.name),
    priceCents: Number(row.price_cents ?? row.priceCents),
    active: row.active !== false,
    allowHalfPrice: Boolean(row.allow_half_price ?? row.allowHalfPrice),
    halfPricePercent: Number(row.half_price_percent ?? row.halfPricePercent ?? 50),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString())
  };
}

export async function saveProduct(input: {
  botId: string;
  name: string;
  priceCents: number;
  allowHalfPrice?: boolean;
  halfPricePercent?: number;
}) {
  const allowHalf = input.allowHalfPrice ?? false;
  const halfPct = input.halfPricePercent ?? 50;
  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO products (bot_id, name, price_cents, allow_half_price, half_price_percent) VALUES ($1,$2,$3,$4,$5)`,
      [input.botId, input.name, input.priceCents, allowHalf, halfPct]
    );
    return;
  }
  const store = await loadFileStore();
  store.products.push({
    id: randomUUID(),
    botId: input.botId,
    name: input.name,
    priceCents: input.priceCents,
    active: true,
    allowHalfPrice: allowHalf,
    halfPricePercent: halfPct,
    createdAt: new Date().toISOString()
  });
  await saveFileStore(store);
}
