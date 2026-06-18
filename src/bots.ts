import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "./config.js";
import { getPool, useDatabase } from "./db/index.js";
import { parseGiftItems, type GiftItem } from "./lib/gifts.js";
import { parseWaApiProvider, type WaApiProvider } from "./lib/wa-api-types.js";

const dataDir = env.DATA_DIR;
const uploadsDir = path.join(dataDir, "uploads");
export const botsFile = path.join(dataDir, "bots.json");

export type NamedAudio = {
  /** Texto que o áudio fala (ex: eu nao sou fake) */
  label: string;
  url: string;
  /** ID usado no prompt: [[audio:nao_sou_fake]] */
  slug?: string;
  /** Frases do lead que podem disparar (opcional) */
  triggers?: string;
  /** @deprecated use triggers */
  keywords?: string;
};

export type BotConfig = {
  id: string;
  userId: string;
  name: string;
  /** Legado Telegram; no WhatsApp usa placeholder wa-{id}. */
  token: string;
  waPort?: number;
  prompt: string;
  pixKey: string;
  pixRecipientName: string;
  messageDelayMs: number;
  previewMediaUrls: string[];
  deliveryMediaUrls: string[];
  audioLibrary: NamedAudio[];
  avatarUrl: string;
  active: boolean;
  paymentMethod: "pix" | "laranjinha";
  laranjinhaApiKeyEncrypted?: string;
  productName: string;
  productPriceCents: number;
  telegramGroupLink: string;
  backupToken?: string;
  giftPrompt?: string;
  giftItems?: GiftItem[];
  /** whatsapp-web.js ou API oficial Meta */
  waApiProvider?: WaApiProvider;
  /** Proxy dedicado por número (whatsapp-web.js) */
  proxyEnabled?: boolean;
  proxyUrlEncrypted?: string;
  /** Meta Cloud API */
  metaPhoneNumberId?: string;
  metaAccessTokenEncrypted?: string;
  metaVerifyToken?: string;
  /** Reengajar lead que parou de responder */
  followUpEnabled?: boolean;
  followUpAfterMinutes?: number;
  followUpMaxPerLead?: number;
};

function parseAudioLibrary(value: unknown): NamedAudio[] {
  if (!value) return [];
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const triggers = String(item?.triggers ?? item?.keywords ?? "").trim();
      const label = String(item?.label ?? "").trim();
      const slugRaw = String(item?.slug ?? "").trim();
      return {
        label,
        url: String(item?.url ?? "").trim(),
        slug: slugRaw || undefined,
        triggers: triggers || undefined,
        keywords: triggers || undefined
      };
    })
    .filter((item) => item.label && item.url);
}

export function parseUrls(value: string) {
  return value
    .split(/\n|,/)
    .map((url) => url.trim())
    .filter(Boolean);
}

export async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });

  try {
    await fs.access(botsFile);
  } catch {
    await fs.writeFile(botsFile, JSON.stringify([], null, 2));
  }
}

function rowToBot(row: {
  id: string;
  user_id?: string;
  name: string;
  token: string;
  prompt: string;
  pix_key: string;
  pix_recipient_name?: string;
  message_delay_ms: number;
  preview_media_urls: string[] | string;
  delivery_media_urls: string[] | string;
  avatar_url?: string;
  active: boolean;
  payment_method?: string;
  laranjinha_api_key_encrypted?: string | null;
  product_name?: string;
  product_price_cents?: number;
  telegram_group_link?: string;
  backup_token?: string | null;
  audio_library?: string[] | string | NamedAudio[];
  gift_prompt?: string | null;
  gift_items?: string[] | string | GiftItem[];
  wa_port?: number | null;
  wa_api_provider?: string | null;
  proxy_enabled?: boolean | null;
  proxy_url_encrypted?: string | null;
  meta_phone_number_id?: string | null;
  meta_access_token_encrypted?: string | null;
  meta_verify_token?: string | null;
  follow_up_enabled?: boolean | null;
  follow_up_after_minutes?: number | null;
  follow_up_max_per_lead?: number | null;
}): BotConfig {
  return {
    id: row.id,
    userId: row.user_id ?? "",
    name: row.name,
    token: row.token,
    waPort: row.wa_port ?? undefined,
    waApiProvider: parseWaApiProvider(row.wa_api_provider),
    proxyEnabled: Boolean(row.proxy_enabled),
    proxyUrlEncrypted: row.proxy_url_encrypted ?? undefined,
    metaPhoneNumberId: row.meta_phone_number_id ?? "",
    metaAccessTokenEncrypted: row.meta_access_token_encrypted ?? undefined,
    metaVerifyToken: row.meta_verify_token ?? "",
    prompt: row.prompt,
    pixKey: row.pix_key,
    pixRecipientName: row.pix_recipient_name ?? row.name,
    messageDelayMs: row.message_delay_ms,
    previewMediaUrls:
      typeof row.preview_media_urls === "string"
        ? JSON.parse(row.preview_media_urls)
        : row.preview_media_urls,
    deliveryMediaUrls:
      typeof row.delivery_media_urls === "string"
        ? JSON.parse(row.delivery_media_urls)
        : row.delivery_media_urls,
    audioLibrary: parseAudioLibrary(row.audio_library),
    avatarUrl: row.avatar_url ?? "",
    active: row.active,
    paymentMethod: row.payment_method === "laranjinha" ? "laranjinha" : "pix",
    laranjinhaApiKeyEncrypted: row.laranjinha_api_key_encrypted ?? undefined,
    productName: row.product_name ?? "VIP",
    productPriceCents: row.product_price_cents ?? 4990,
    telegramGroupLink: row.telegram_group_link ?? "",
    backupToken: row.backup_token ?? undefined,
    giftPrompt: row.gift_prompt ?? "",
    giftItems: parseGiftItems(row.gift_items),
    followUpEnabled: row.follow_up_enabled !== false,
    followUpAfterMinutes: row.follow_up_after_minutes ?? 10,
    followUpMaxPerLead: row.follow_up_max_per_lead ?? 2
  };
}

const BOT_SELECT = `SELECT id, user_id, name, token, prompt, pix_key, pix_recipient_name, message_delay_ms,
  preview_media_urls, delivery_media_urls, audio_library, avatar_url, active,
  payment_method, laranjinha_api_key_encrypted, product_name, product_price_cents, telegram_group_link, backup_token,
  gift_prompt, gift_items, wa_port, wa_api_provider, proxy_enabled, proxy_url_encrypted,
  meta_phone_number_id, meta_access_token_encrypted, meta_verify_token,
  follow_up_enabled, follow_up_after_minutes, follow_up_max_per_lead
  FROM bots`;

/** Carrega bots. Sem userId = todos (runtime Telegram). Com userId = painel do cliente. */
export async function loadBots(userId?: string) {
  if (useDatabase()) {
    const { rows } = userId
      ? await getPool().query(`${BOT_SELECT} WHERE user_id = $1 ORDER BY created_at ASC`, [userId])
      : await getPool().query(`${BOT_SELECT} ORDER BY created_at ASC`);
    return rows.map(rowToBot);
  }

  await ensureDataFile();
  const raw = await fs.readFile(botsFile, "utf8");
  const bots = JSON.parse(raw) as Partial<BotConfig>[];
  const normalized = bots.map((b) => ({
    ...b,
    userId: b.userId ?? "",
    avatarUrl: b.avatarUrl ?? "",
    pixRecipientName: b.pixRecipientName ?? b.name ?? "Recebedor",
    productName: b.productName ?? "VIP",
    productPriceCents: b.productPriceCents ?? 4990,
    telegramGroupLink: b.telegramGroupLink ?? "",
    backupToken: b.backupToken,
    paymentMethod: b.paymentMethod === "laranjinha" ? "laranjinha" : "pix",
    audioLibrary: parseAudioLibrary(b.audioLibrary),
    giftPrompt: b.giftPrompt ?? "",
    giftItems: parseGiftItems(b.giftItems),
    waApiProvider: parseWaApiProvider(b.waApiProvider),
    proxyEnabled: Boolean(b.proxyEnabled),
    proxyUrlEncrypted: b.proxyUrlEncrypted,
    metaPhoneNumberId: b.metaPhoneNumberId ?? "",
    metaAccessTokenEncrypted: b.metaAccessTokenEncrypted,
    metaVerifyToken: b.metaVerifyToken ?? ""
  })) as BotConfig[];

  return userId ? normalized.filter((b) => b.userId === userId) : normalized;
}

export async function getBotById(id: string, userId: string) {
  const bots = await loadBots(userId);
  return bots.find((b) => b.id === id) ?? null;
}

/** Runtime / webhooks Meta (sem filtro de usuário). */
export async function getBotByIdAny(id: string) {
  const bots = await loadBots();
  return bots.find((b) => b.id === id) ?? null;
}

export async function upsertBot(bot: BotConfig) {
  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO bots (id, user_id, name, token, prompt, pix_key, pix_recipient_name, message_delay_ms,
        preview_media_urls, delivery_media_urls, audio_library, avatar_url, active,
        payment_method, laranjinha_api_key_encrypted, product_name, product_price_cents, telegram_group_link, backup_token,
        gift_prompt, gift_items, wa_port, wa_api_provider, proxy_enabled, proxy_url_encrypted,
        meta_phone_number_id, meta_access_token_encrypted, meta_verify_token,
        follow_up_enabled, follow_up_after_minutes, follow_up_max_per_lead)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         name = EXCLUDED.name,
         token = EXCLUDED.token,
         prompt = EXCLUDED.prompt,
         pix_key = EXCLUDED.pix_key,
         pix_recipient_name = EXCLUDED.pix_recipient_name,
         message_delay_ms = EXCLUDED.message_delay_ms,
         preview_media_urls = EXCLUDED.preview_media_urls,
         delivery_media_urls = EXCLUDED.delivery_media_urls,
         audio_library = EXCLUDED.audio_library,
         avatar_url = EXCLUDED.avatar_url,
         active = EXCLUDED.active,
         payment_method = EXCLUDED.payment_method,
         laranjinha_api_key_encrypted = EXCLUDED.laranjinha_api_key_encrypted,
         product_name = EXCLUDED.product_name,
         product_price_cents = EXCLUDED.product_price_cents,
         telegram_group_link = EXCLUDED.telegram_group_link,
         backup_token = EXCLUDED.backup_token,
         gift_prompt = EXCLUDED.gift_prompt,
         gift_items = EXCLUDED.gift_items,
         wa_port = EXCLUDED.wa_port,
         wa_api_provider = EXCLUDED.wa_api_provider,
         proxy_enabled = EXCLUDED.proxy_enabled,
         proxy_url_encrypted = EXCLUDED.proxy_url_encrypted,
         meta_phone_number_id = EXCLUDED.meta_phone_number_id,
         meta_access_token_encrypted = EXCLUDED.meta_access_token_encrypted,
         meta_verify_token = EXCLUDED.meta_verify_token,
         follow_up_enabled = EXCLUDED.follow_up_enabled,
         follow_up_after_minutes = EXCLUDED.follow_up_after_minutes,
         follow_up_max_per_lead = EXCLUDED.follow_up_max_per_lead`,
      [
        bot.id,
        bot.userId,
        bot.name,
        bot.token,
        bot.prompt,
        bot.pixKey,
        bot.pixRecipientName,
        bot.messageDelayMs,
        JSON.stringify(bot.previewMediaUrls),
        JSON.stringify(bot.deliveryMediaUrls),
        JSON.stringify(bot.audioLibrary ?? []),
        bot.avatarUrl,
        bot.active,
        bot.paymentMethod,
        bot.laranjinhaApiKeyEncrypted ?? null,
        bot.productName,
        bot.productPriceCents,
        bot.telegramGroupLink,
        bot.backupToken ?? null,
        bot.giftPrompt ?? "",
        JSON.stringify(bot.giftItems ?? []),
        bot.waPort ?? null,
        bot.waApiProvider ?? "whatsapp_web",
        Boolean(bot.proxyEnabled),
        bot.proxyUrlEncrypted ?? null,
        bot.metaPhoneNumberId ?? "",
        bot.metaAccessTokenEncrypted ?? null,
        bot.metaVerifyToken ?? "",
        bot.followUpEnabled !== false,
        bot.followUpAfterMinutes ?? 10,
        bot.followUpMaxPerLead ?? 2
      ]
    );
    return;
  }

  const all = await loadBots();
  const idx = all.findIndex((b) => b.id === bot.id);
  if (idx >= 0) all[idx] = bot;
  else all.push(bot);
  await fs.writeFile(botsFile, JSON.stringify(all, null, 2));
}

export async function deleteBot(id: string, userId: string) {
  if (useDatabase()) {
    await getPool().query(`DELETE FROM bots WHERE id = $1 AND user_id = $2`, [id, userId]);
    return;
  }

  const all = await loadBots();
  await fs.writeFile(
    botsFile,
    JSON.stringify(
      all.filter((b) => !(b.id === id && b.userId === userId)),
      null,
      2
    )
  );
}

/** Legado: salva lista inteira de um usuario (arquivo local). */
export async function saveBotsForUser(userId: string, bots: BotConfig[]) {
  if (useDatabase()) {
    for (const bot of bots) {
      await upsertBot({ ...bot, userId });
    }
    return;
  }

  const others = (await loadBots()).filter((b) => b.userId !== userId);
  await fs.writeFile(botsFile, JSON.stringify([...others, ...bots.map((b) => ({ ...b, userId }))], null, 2));
}

export { uploadsDir, dataDir };
