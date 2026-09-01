import { getPool, useDatabase } from "../db/index.js";
import { botsFile, ensureDataFile, loadBots, type BotConfig } from "../bots.js";
import type { GiftItem } from "./gifts.js";
import { parseUpsellRules, type UpsellRule } from "./upsell.js";
import fs from "node:fs/promises";

export type BotEngagementConfig = {
  giftPrompt?: string;
  giftItems?: GiftItem[];
  postSaleEnabled?: boolean;
  postSaleWaitDays?: number;
  postSaleOpenerPrompt?: string;
  postSaleWarmupReplies?: number;
  postSaleGiftDelayMinutes?: number;
  upsellEnabled?: boolean;
  upsellDelayMinutes?: number;
  upsellInPostSale?: boolean;
  upsellPrompt?: string;
  upsellRules?: UpsellRule[];
};

export async function initEngagementSchema() {
  if (!useDatabase()) return;
  await getPool().query(`
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS post_sale_enabled BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS post_sale_wait_days INTEGER NOT NULL DEFAULT 2;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS post_sale_opener_prompt TEXT NOT NULL DEFAULT '';
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS post_sale_warmup_replies INTEGER NOT NULL DEFAULT 2;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS post_sale_gift_delay_minutes INTEGER NOT NULL DEFAULT 45;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS upsell_enabled BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS upsell_delay_minutes INTEGER NOT NULL DEFAULT 2;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS upsell_in_post_sale BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS upsell_prompt TEXT NOT NULL DEFAULT '';
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS upsell_rules JSONB NOT NULL DEFAULT '[]';
  `);
}

export async function saveBotEngagement(botId: string, patch: BotEngagementConfig) {
  if (useDatabase()) {
    await getPool().query(
      `UPDATE bots SET
        gift_prompt = COALESCE($2, gift_prompt),
        gift_items = COALESCE($3::jsonb, gift_items),
        post_sale_enabled = COALESCE($4, post_sale_enabled),
        post_sale_wait_days = COALESCE($5, post_sale_wait_days),
        post_sale_opener_prompt = COALESCE($6, post_sale_opener_prompt),
        post_sale_warmup_replies = COALESCE($7, post_sale_warmup_replies),
        post_sale_gift_delay_minutes = COALESCE($8, post_sale_gift_delay_minutes),
        upsell_enabled = COALESCE($9, upsell_enabled),
        upsell_delay_minutes = COALESCE($10, upsell_delay_minutes),
        upsell_in_post_sale = COALESCE($11, upsell_in_post_sale),
        upsell_prompt = COALESCE($12, upsell_prompt),
        upsell_rules = COALESCE($13::jsonb, upsell_rules)
      WHERE id = $1`,
      [
        botId,
        patch.giftPrompt ?? null,
        patch.giftItems ? JSON.stringify(patch.giftItems) : null,
        patch.postSaleEnabled ?? null,
        patch.postSaleWaitDays ?? null,
        patch.postSaleOpenerPrompt ?? null,
        patch.postSaleWarmupReplies ?? null,
        patch.postSaleGiftDelayMinutes ?? null,
        patch.upsellEnabled ?? null,
        patch.upsellDelayMinutes ?? null,
        patch.upsellInPostSale ?? null,
        patch.upsellPrompt ?? null,
        patch.upsellRules ? JSON.stringify(patch.upsellRules) : null
      ]
    );
    return;
  }

  await ensureDataFile();
  const raw = await fs.readFile(botsFile, "utf8");
  const bots = JSON.parse(raw) as BotConfig[];
  const idx = bots.findIndex((b) => b.id === botId);
  if (idx < 0) throw new Error("Instância não encontrada.");
  bots[idx] = { ...bots[idx]!, ...patch };
  await fs.writeFile(botsFile, JSON.stringify(bots, null, 2));
}

export function mergeUpsellRules(
  existing: UpsellRule[],
  raw: Record<string, string | string[]>
): UpsellRule[] {
  const fromList = raw.upsellFrom;
  const toList = raw.upsellTo;
  const msgList = raw.upsellMessage;
  const fromArr = Array.isArray(fromList) ? fromList : fromList ? [fromList] : [];
  const toArr = Array.isArray(toList) ? toList : toList ? [toList] : [];
  const msgArr = Array.isArray(msgList) ? msgList : msgList ? [msgList] : [];
  const remove = new Set(
    (Array.isArray(raw.removeUpsellIndexes)
      ? raw.removeUpsellIndexes
      : raw.removeUpsellIndexes
        ? [raw.removeUpsellIndexes]
        : []
    ).map((v) => Number(v))
  );
  const kept = existing.filter((_, i) => !remove.has(i));
  const added = fromArr
    .map((from, i) => ({
      fromProduct: String(from || "").trim(),
      toProduct: String(toArr[i] || "").trim(),
      message: String(msgArr[i] || "").trim()
    }))
    .filter((r) => r.toProduct)
    .map((r) => ({
      ...r,
      message:
        r.message ||
        "amor, gostou? se fechar o {to} por so R${diff} a mais eu libero agora 😈"
    }));
  return [...kept, ...added];
}
