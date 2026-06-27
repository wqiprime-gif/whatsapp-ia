import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "./config.js";
import { getPool, useDatabase } from "./db/index.js";
import { parseGiftItems, type GiftItem } from "./lib/gifts.js";
import { parseFollowUpSteps, type FollowUpStep } from "./lib/follow-up.js";
import { parseWaApiProvider, type WaApiProvider } from "./lib/wa-api-types.js";
import { normalizeAIProvider, type AIProviderId, sanitizeAIModel } from "./lib/ai-providers.js";
import { parseBotPlatform, type BotPlatform, isWhatsAppBot } from "./lib/platform-types.js";

export type { BotPlatform };
export { isWhatsAppBot, parseBotPlatform };

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
  /** No WhatsApp usa placeholder wa-{id}. */
  token: string;
  /** Mantido por compatibilidade; sempre "whatsapp". */
  platform?: BotPlatform;
  waPort?: number;
  prompt: string;
  pixKey: string;
  pixRecipientName: string;
  messageDelayMs: number;
  previewMediaUrls: string[];
  /** Apresentação do produto (o que o lead recebe após comprar) — envio único por lead */
  productPresentationEnabled?: boolean;
  productPresentationMediaUrls?: string[];
  deliveryMediaUrls: string[];
  audioLibrary: NamedAudio[];
  avatarUrl: string;
  active: boolean;
  paymentMethod: "pix" | "laranjinha";
  laranjinhaApiKeyEncrypted?: string;
  productName: string;
  productPriceCents: number;
  /** Link de entrega do produto enviado após o Pix aprovado (Drive, canal VIP, página etc.). */
  deliveryLink: string;
  backupToken?: string;
  giftPrompt?: string;
  giftItems?: GiftItem[];
  /** Pós-venda automático — reengajar compradores */
  postSaleEnabled?: boolean;
  postSaleWaitDays?: number;
  postSaleOpenerPrompt?: string;
  postSaleWarmupReplies?: number;
  postSaleGiftDelayMinutes?: number;
  /** whatsapp-web.js ou API oficial Meta (legado) */
  waApiProvider?: WaApiProvider;
  /** Número WhatsApp conectado (DDI+DDD+número) — usado no gerador de links */
  waPhoneNumber?: string;
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
  /** Mensagens fixas de follow-up (vazio = IA no tom do prompt) */
  followUpSteps?: FollowUpStep[];
  /** Imagem da tabela de pacotes enviada no lugar do texto */
  priceTableImageUrl?: string;
  /** IA dedicada desta instância (sobrescreve Configurações globais). */
  aiProvider?: AIProviderId;
  aiModel?: string;
  aiApiKeyEncrypted?: string;
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
  follow_up_steps?: FollowUpStep[] | string | null;
  price_table_image_url?: string | null;
  ai_provider?: string | null;
  ai_model?: string | null;
  ai_api_key_encrypted?: string | null;
  platform?: string | null;
  product_presentation_enabled?: boolean | null;
  product_presentation_media_urls?: string[] | string;
  wa_phone_number?: string | null;
}): BotConfig {
  return {
    id: row.id,
    userId: row.user_id ?? "",
    name: row.name,
    token: row.token,
    platform: parseBotPlatform(row.platform),
    waPort: row.wa_port ?? undefined,
    waApiProvider: parseWaApiProvider(row.wa_api_provider),
    waPhoneNumber: row.wa_phone_number?.trim() || "",
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
    productPresentationEnabled: Boolean(row.product_presentation_enabled),
    productPresentationMediaUrls:
      typeof row.product_presentation_media_urls === "string"
        ? JSON.parse(row.product_presentation_media_urls)
        : (row.product_presentation_media_urls ?? []),
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
    deliveryLink: row.telegram_group_link ?? "",
    backupToken: row.backup_token ?? undefined,
    giftPrompt: row.gift_prompt ?? "",
    giftItems: parseGiftItems(row.gift_items),
    postSaleEnabled: Boolean((row as { post_sale_enabled?: boolean }).post_sale_enabled),
    postSaleWaitDays: Number((row as { post_sale_wait_days?: number }).post_sale_wait_days ?? 2),
    postSaleOpenerPrompt: (row as { post_sale_opener_prompt?: string }).post_sale_opener_prompt ?? "",
    postSaleWarmupReplies: Number((row as { post_sale_warmup_replies?: number }).post_sale_warmup_replies ?? 2),
    postSaleGiftDelayMinutes: Number((row as { post_sale_gift_delay_minutes?: number }).post_sale_gift_delay_minutes ?? 45),
    followUpEnabled: row.follow_up_enabled !== false,
    followUpAfterMinutes: row.follow_up_after_minutes ?? 10,
    followUpMaxPerLead: row.follow_up_max_per_lead ?? 2,
    followUpSteps: parseFollowUpSteps(row.follow_up_steps),
    priceTableImageUrl: row.price_table_image_url ?? "",
    aiProvider: normalizeAIProvider(row.ai_provider),
    aiModel: sanitizeAIModel(normalizeAIProvider(row.ai_provider), row.ai_model),
    aiApiKeyEncrypted: row.ai_api_key_encrypted ?? undefined
  };
}

const BOT_SELECT = `SELECT id, user_id, name, token, platform, prompt, pix_key, pix_recipient_name, message_delay_ms,
  preview_media_urls, product_presentation_enabled, product_presentation_media_urls,
  delivery_media_urls, audio_library, avatar_url, active,
  payment_method, laranjinha_api_key_encrypted, product_name, product_price_cents, telegram_group_link, backup_token,
  gift_prompt, gift_items, wa_port, wa_api_provider, wa_phone_number, proxy_enabled, proxy_url_encrypted,
  meta_phone_number_id, meta_access_token_encrypted, meta_verify_token,
  follow_up_enabled, follow_up_after_minutes, follow_up_max_per_lead, follow_up_steps,
  price_table_image_url,
  ai_provider, ai_model, ai_api_key_encrypted
  FROM bots`;

/** Carrega bots. Sem userId = todos (runtime). Com userId = painel do cliente. */
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
    deliveryLink: b.deliveryLink ?? (b as { telegramGroupLink?: string }).telegramGroupLink ?? "",
    backupToken: b.backupToken,
    paymentMethod: b.paymentMethod === "laranjinha" ? "laranjinha" : "pix",
    audioLibrary: parseAudioLibrary(b.audioLibrary),
    giftPrompt: b.giftPrompt ?? "",
    giftItems: parseGiftItems(b.giftItems),
    postSaleEnabled: Boolean(b.postSaleEnabled),
    postSaleWaitDays: b.postSaleWaitDays ?? 2,
    postSaleOpenerPrompt: b.postSaleOpenerPrompt ?? "",
    postSaleWarmupReplies: b.postSaleWarmupReplies ?? 2,
    postSaleGiftDelayMinutes: b.postSaleGiftDelayMinutes ?? 45,
    waApiProvider: parseWaApiProvider(b.waApiProvider),
    waPhoneNumber: b.waPhoneNumber?.trim() || "",
    proxyEnabled: Boolean(b.proxyEnabled),
    proxyUrlEncrypted: b.proxyUrlEncrypted,
    metaPhoneNumberId: b.metaPhoneNumberId ?? "",
    metaAccessTokenEncrypted: b.metaAccessTokenEncrypted,
    metaVerifyToken: b.metaVerifyToken ?? "",
    aiProvider: normalizeAIProvider(b.aiProvider),
    aiModel: b.aiModel ? sanitizeAIModel(normalizeAIProvider(b.aiProvider), b.aiModel) : undefined,
    aiApiKeyEncrypted: b.aiApiKeyEncrypted,
    platform: parseBotPlatform(b.platform),
    productPresentationEnabled: Boolean(b.productPresentationEnabled),
    productPresentationMediaUrls: b.productPresentationMediaUrls ?? [],
    followUpSteps: parseFollowUpSteps(b.followUpSteps),
    priceTableImageUrl: b.priceTableImageUrl ?? ""
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
      `INSERT INTO bots (id, user_id, name, token, platform, prompt, pix_key, pix_recipient_name, message_delay_ms,
        preview_media_urls, product_presentation_enabled, product_presentation_media_urls,
        delivery_media_urls, audio_library, avatar_url, active,
        payment_method, laranjinha_api_key_encrypted, product_name, product_price_cents, telegram_group_link, backup_token,
        gift_prompt, gift_items, wa_port, wa_api_provider, wa_phone_number, proxy_enabled, proxy_url_encrypted,
        meta_phone_number_id, meta_access_token_encrypted, meta_verify_token,
        follow_up_enabled, follow_up_after_minutes, follow_up_max_per_lead, follow_up_steps,
        price_table_image_url,
        ai_provider, ai_model, ai_api_key_encrypted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40)
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         name = EXCLUDED.name,
         token = EXCLUDED.token,
         platform = EXCLUDED.platform,
         prompt = EXCLUDED.prompt,
         pix_key = EXCLUDED.pix_key,
         pix_recipient_name = EXCLUDED.pix_recipient_name,
         message_delay_ms = EXCLUDED.message_delay_ms,
         preview_media_urls = EXCLUDED.preview_media_urls,
         product_presentation_enabled = EXCLUDED.product_presentation_enabled,
         product_presentation_media_urls = EXCLUDED.product_presentation_media_urls,
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
         wa_phone_number = EXCLUDED.wa_phone_number,
         proxy_enabled = EXCLUDED.proxy_enabled,
         proxy_url_encrypted = EXCLUDED.proxy_url_encrypted,
         meta_phone_number_id = EXCLUDED.meta_phone_number_id,
         meta_access_token_encrypted = EXCLUDED.meta_access_token_encrypted,
         meta_verify_token = EXCLUDED.meta_verify_token,
         follow_up_enabled = EXCLUDED.follow_up_enabled,
         follow_up_after_minutes = EXCLUDED.follow_up_after_minutes,
         follow_up_max_per_lead = EXCLUDED.follow_up_max_per_lead,
         follow_up_steps = EXCLUDED.follow_up_steps,
         price_table_image_url = EXCLUDED.price_table_image_url,
         ai_provider = EXCLUDED.ai_provider,
         ai_model = EXCLUDED.ai_model,
         ai_api_key_encrypted = COALESCE(EXCLUDED.ai_api_key_encrypted, bots.ai_api_key_encrypted)`,
      [
        bot.id,
        bot.userId,
        bot.name,
        bot.token,
        bot.platform ?? "whatsapp",
        bot.prompt,
        bot.pixKey,
        bot.pixRecipientName,
        bot.messageDelayMs,
        JSON.stringify(bot.previewMediaUrls),
        Boolean(bot.productPresentationEnabled),
        JSON.stringify(bot.productPresentationMediaUrls ?? []),
        JSON.stringify(bot.deliveryMediaUrls),
        JSON.stringify(bot.audioLibrary ?? []),
        bot.avatarUrl,
        bot.active,
        bot.paymentMethod,
        bot.laranjinhaApiKeyEncrypted ?? null,
        bot.productName,
        bot.productPriceCents,
        bot.deliveryLink,
        bot.backupToken ?? null,
        bot.giftPrompt ?? "",
        JSON.stringify(bot.giftItems ?? []),
        bot.waPort ?? null,
        bot.waApiProvider ?? "whatsapp_web",
        bot.waPhoneNumber?.trim() || "",
        Boolean(bot.proxyEnabled),
        bot.proxyUrlEncrypted ?? null,
        bot.metaPhoneNumberId ?? "",
        bot.metaAccessTokenEncrypted ?? null,
        bot.metaVerifyToken ?? "",
        bot.followUpEnabled !== false,
        bot.followUpAfterMinutes ?? 10,
        bot.followUpMaxPerLead ?? 2,
        JSON.stringify(bot.followUpSteps ?? []),
        bot.priceTableImageUrl ?? "",
        bot.aiProvider ?? "openai",
        bot.aiModel ?? null,
        bot.aiApiKeyEncrypted ?? null
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
