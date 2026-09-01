import { useDatabase, getPool } from "./index.js";

/** Estado estruturado do funil por lead — espelha src/lib/lead-state.ts + flags do hotbot. */
export type LeadStateRow = {
  botId: string;
  chatId: number;
  userMessageCount: number;
  hasSentInformacoes: boolean;
  hasSentAmostra: boolean;
  hasSentChamadaVideo: boolean;
  hasSentNaoSouFake: boolean;
  coldStrike: number;
  paid: boolean;
  paidAt: string | null;
  selectedPackage: string | null;
  selectedProductName: string | null;
  selectedProductPriceCents: number | null;
  offeredHalfPrice: boolean;
  halfPriceProductName: string | null;
  followUpCount: number;
  lastUserMessageAt: string | null;
  lastBotMessageAt: string | null;
  postSaleActive: boolean;
  postSaleStage: string | null;
  postSaleUserReplies: number;
  sentAudioSlugs: string[];
  previewSent: boolean;
  funnelStage: string;
  lastObjection: string | null;
  upsellOffered: boolean;
  purchasedProductName: string | null;
  stateJson: Record<string, unknown>;
  updatedAt: string;
};

export type LeadStatePatch = Partial<
  Omit<LeadStateRow, "botId" | "chatId" | "updatedAt">
>;

export function emptyLeadState(botId: string, chatId: number): LeadStateRow {
  const now = new Date().toISOString();
  return {
    botId,
    chatId,
    userMessageCount: 0,
    hasSentInformacoes: false,
    hasSentAmostra: false,
    hasSentChamadaVideo: false,
    hasSentNaoSouFake: false,
    coldStrike: 0,
    paid: false,
    paidAt: null,
    selectedPackage: null,
    selectedProductName: null,
    selectedProductPriceCents: null,
    offeredHalfPrice: false,
    halfPriceProductName: null,
    followUpCount: 0,
    lastUserMessageAt: null,
    lastBotMessageAt: null,
    postSaleActive: false,
    postSaleStage: null,
    postSaleUserReplies: 0,
    sentAudioSlugs: [],
    previewSent: false,
    funnelStage: "new",
    lastObjection: null,
    upsellOffered: false,
    purchasedProductName: null,
    stateJson: {},
    updatedAt: now
  };
}

function rowToLeadState(r: Record<string, unknown>): LeadStateRow {
  const slugs = r.sent_audio_slugs;
  return {
    botId: String(r.bot_id),
    chatId: Number(r.chat_id),
    userMessageCount: Number(r.user_message_count ?? 0),
    hasSentInformacoes: Boolean(r.has_sent_informacoes),
    hasSentAmostra: Boolean(r.has_sent_amostra),
    hasSentChamadaVideo: Boolean(r.has_sent_chamada_video),
    hasSentNaoSouFake: Boolean(r.has_sent_nao_sou_fake),
    coldStrike: Number(r.cold_strike ?? 0),
    paid: Boolean(r.paid),
    paidAt: r.paid_at ? new Date(String(r.paid_at)).toISOString() : null,
    selectedPackage: r.selected_package ? String(r.selected_package) : null,
    selectedProductName: r.selected_product_name ? String(r.selected_product_name) : null,
    selectedProductPriceCents:
      r.selected_product_price_cents != null ? Number(r.selected_product_price_cents) : null,
    offeredHalfPrice: Boolean(r.offered_half_price),
    halfPriceProductName: r.half_price_product_name ? String(r.half_price_product_name) : null,
    followUpCount: Number(r.follow_up_count ?? 0),
    lastUserMessageAt: r.last_user_message_at
      ? new Date(String(r.last_user_message_at)).toISOString()
      : null,
    lastBotMessageAt: r.last_bot_message_at
      ? new Date(String(r.last_bot_message_at)).toISOString()
      : null,
    postSaleActive: Boolean(r.post_sale_active),
    postSaleStage: r.post_sale_stage ? String(r.post_sale_stage) : null,
    postSaleUserReplies: Number(r.post_sale_user_replies ?? 0),
    sentAudioSlugs: Array.isArray(slugs) ? slugs.map(String) : [],
    previewSent: Boolean(r.preview_sent),
    funnelStage: r.funnel_stage ? String(r.funnel_stage) : "new",
    lastObjection: r.last_objection ? String(r.last_objection) : null,
    upsellOffered: Boolean(r.upsell_offered),
    purchasedProductName: r.purchased_product_name ? String(r.purchased_product_name) : null,
    stateJson:
      r.state_json && typeof r.state_json === "object" && !Array.isArray(r.state_json)
        ? (r.state_json as Record<string, unknown>)
        : {},
    updatedAt: r.updated_at ? new Date(String(r.updated_at)).toISOString() : new Date().toISOString()
  };
}

export async function initLeadStateSchema() {
  if (!useDatabase()) return;

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS lead_state (
      bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
      chat_id BIGINT NOT NULL,
      user_message_count INTEGER NOT NULL DEFAULT 0,
      has_sent_informacoes BOOLEAN NOT NULL DEFAULT false,
      has_sent_amostra BOOLEAN NOT NULL DEFAULT false,
      has_sent_chamada_video BOOLEAN NOT NULL DEFAULT false,
      has_sent_nao_sou_fake BOOLEAN NOT NULL DEFAULT false,
      cold_strike SMALLINT NOT NULL DEFAULT 0,
      paid BOOLEAN NOT NULL DEFAULT false,
      paid_at TIMESTAMPTZ,
      selected_package TEXT,
      selected_product_name TEXT,
      selected_product_price_cents INTEGER,
      offered_half_price BOOLEAN NOT NULL DEFAULT false,
      half_price_product_name TEXT,
      follow_up_count SMALLINT NOT NULL DEFAULT 0,
      last_user_message_at TIMESTAMPTZ,
      last_bot_message_at TIMESTAMPTZ,
      post_sale_active BOOLEAN NOT NULL DEFAULT false,
      post_sale_stage TEXT,
      post_sale_user_replies SMALLINT NOT NULL DEFAULT 0,
      sent_audio_slugs JSONB NOT NULL DEFAULT '[]',
      preview_sent BOOLEAN NOT NULL DEFAULT false,
      funnel_stage TEXT NOT NULL DEFAULT 'new',
      last_objection TEXT,
      upsell_offered BOOLEAN NOT NULL DEFAULT false,
      purchased_product_name TEXT,
      state_json JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (bot_id, chat_id)
    );

    CREATE INDEX IF NOT EXISTS lead_state_paid_idx ON lead_state (bot_id, paid);
    CREATE INDEX IF NOT EXISTS lead_state_follow_up_idx ON lead_state (bot_id, last_bot_message_at)
      WHERE paid = false;

    CREATE TABLE IF NOT EXISTS funnel_approaches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
      chat_id BIGINT NOT NULL,
      approach TEXT NOT NULL,
      converted BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS funnel_approaches_bot_idx
      ON funnel_approaches (bot_id, approach, converted, created_at DESC);

    ALTER TABLE lead_state ADD COLUMN IF NOT EXISTS funnel_stage TEXT NOT NULL DEFAULT 'new';
    ALTER TABLE lead_state ADD COLUMN IF NOT EXISTS last_objection TEXT;
    ALTER TABLE lead_state ADD COLUMN IF NOT EXISTS upsell_offered BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE lead_state ADD COLUMN IF NOT EXISTS purchased_product_name TEXT;
  `);
}

export async function getLeadState(botId: string, chatId: number): Promise<LeadStateRow> {
  if (!useDatabase()) return emptyLeadState(botId, chatId);

  const { rows } = await getPool().query(
    `SELECT * FROM lead_state WHERE bot_id = $1 AND chat_id = $2`,
    [botId, chatId]
  );
  if (!rows[0]) return emptyLeadState(botId, chatId);
  return rowToLeadState(rows[0] as Record<string, unknown>);
}

export async function patchLeadState(
  botId: string,
  chatId: number,
  patch: LeadStatePatch
): Promise<LeadStateRow> {
  const current = await getLeadState(botId, chatId);
  const merged: LeadStateRow = {
    ...current,
    ...patch,
    botId,
    chatId,
    updatedAt: new Date().toISOString()
  };
  return saveLeadStateFull(merged);
}

async function saveLeadStateFull(merged: LeadStateRow): Promise<LeadStateRow> {
  if (!useDatabase()) return merged;

  const { rows } = await getPool().query(
    `INSERT INTO lead_state (
      bot_id, chat_id, user_message_count, has_sent_informacoes, has_sent_amostra,
      has_sent_chamada_video, has_sent_nao_sou_fake, cold_strike, paid, paid_at,
      selected_package, selected_product_name, selected_product_price_cents,
      offered_half_price, half_price_product_name, follow_up_count,
      last_user_message_at, last_bot_message_at, post_sale_active, post_sale_stage,
      post_sale_user_replies, sent_audio_slugs, preview_sent,
      funnel_stage, last_objection, upsell_offered, purchased_product_name,
      state_json, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23,$24,$25,$26,$27,$28::jsonb,NOW()
    )
    ON CONFLICT (bot_id, chat_id) DO UPDATE SET
      user_message_count = COALESCE($3, lead_state.user_message_count),
      has_sent_informacoes = COALESCE($4, lead_state.has_sent_informacoes),
      has_sent_amostra = COALESCE($5, lead_state.has_sent_amostra),
      has_sent_chamada_video = COALESCE($6, lead_state.has_sent_chamada_video),
      has_sent_nao_sou_fake = COALESCE($7, lead_state.has_sent_nao_sou_fake),
      cold_strike = COALESCE($8, lead_state.cold_strike),
      paid = COALESCE($9, lead_state.paid),
      paid_at = COALESCE($10, lead_state.paid_at),
      selected_package = COALESCE($11, lead_state.selected_package),
      selected_product_name = COALESCE($12, lead_state.selected_product_name),
      selected_product_price_cents = COALESCE($13, lead_state.selected_product_price_cents),
      offered_half_price = COALESCE($14, lead_state.offered_half_price),
      half_price_product_name = COALESCE($15, lead_state.half_price_product_name),
      follow_up_count = COALESCE($16, lead_state.follow_up_count),
      last_user_message_at = COALESCE($17, lead_state.last_user_message_at),
      last_bot_message_at = COALESCE($18, lead_state.last_bot_message_at),
      post_sale_active = COALESCE($19, lead_state.post_sale_active),
      post_sale_stage = COALESCE($20, lead_state.post_sale_stage),
      post_sale_user_replies = COALESCE($21, lead_state.post_sale_user_replies),
      sent_audio_slugs = COALESCE($22::jsonb, lead_state.sent_audio_slugs),
      preview_sent = COALESCE($23, lead_state.preview_sent),
      funnel_stage = COALESCE($24, lead_state.funnel_stage),
      last_objection = COALESCE($25, lead_state.last_objection),
      upsell_offered = COALESCE($26, lead_state.upsell_offered),
      purchased_product_name = COALESCE($27, lead_state.purchased_product_name),
      state_json = COALESCE($28::jsonb, lead_state.state_json),
      updated_at = NOW()
    RETURNING *`,
    [
      merged.botId,
      merged.chatId,
      merged.userMessageCount,
      merged.hasSentInformacoes,
      merged.hasSentAmostra,
      merged.hasSentChamadaVideo,
      merged.hasSentNaoSouFake,
      merged.coldStrike,
      merged.paid,
      merged.paidAt,
      merged.selectedPackage,
      merged.selectedProductName,
      merged.selectedProductPriceCents,
      merged.offeredHalfPrice,
      merged.halfPriceProductName,
      merged.followUpCount,
      merged.lastUserMessageAt,
      merged.lastBotMessageAt,
      merged.postSaleActive,
      merged.postSaleStage,
      merged.postSaleUserReplies,
      JSON.stringify(merged.sentAudioSlugs ?? []),
      merged.previewSent,
      merged.funnelStage,
      merged.lastObjection,
      merged.upsellOffered,
      merged.purchasedProductName,
      JSON.stringify(merged.stateJson ?? {})
    ]
  );

  return rowToLeadState(rows[0] as Record<string, unknown>);
}

export async function recordFunnelApproach(
  botId: string,
  chatId: number,
  approach: string,
  converted = false
) {
  if (!useDatabase()) return;
  await getPool().query(
    `INSERT INTO funnel_approaches (bot_id, chat_id, approach, converted) VALUES ($1,$2,$3,$4)`,
    [botId, chatId, approach.slice(0, 64), converted]
  );
}

export async function funnelApproachStats(botId: string, limit = 20) {
  if (!useDatabase()) return [];
  const { rows } = await getPool().query(
    `SELECT approach,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE converted)::int AS converted
     FROM funnel_approaches
     WHERE bot_id = $1
     GROUP BY approach
     ORDER BY total DESC
     LIMIT $2`,
    [botId, limit]
  );
  return rows as { approach: string; total: number; converted: number }[];
}
