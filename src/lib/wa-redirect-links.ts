import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config.js";
import { getPool, useDatabase } from "../db/index.js";

import { normalizeWaPhone } from "./wa-links.js";

export type WaRedirectLink = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  initialMessage: string;
  botIds: string[];
  /** Número manual por instância (botId → dígitos E.164). */
  phones: Record<string, string>;
  clickCounts: Record<string, number>;
  createdAt: string;
  updatedAt: string;
};

const filePath = path.join(env.DATA_DIR, "wa-redirect-links.json");

type FileStore = { links: WaRedirectLink[] };

async function loadFile(): Promise<FileStore> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw) as FileStore;
    return {
      links: (data.links ?? []).map((l) => ({
        ...l,
        phones: l.phones && typeof l.phones === "object" ? l.phones : {}
      }))
    };
  } catch {
    return { links: [] };
  }
}

async function saveFile(store: FileStore) {
  await fs.mkdir(env.DATA_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2));
}

export function normalizeLinkSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function rowToLink(row: {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  initial_message: string | null;
  bot_ids: string[] | string;
  phones?: Record<string, string> | string | null;
  click_counts: Record<string, number> | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}): WaRedirectLink {
  const botIds = typeof row.bot_ids === "string" ? JSON.parse(row.bot_ids) : row.bot_ids ?? [];
  const phonesRaw =
    typeof row.phones === "string" ? JSON.parse(row.phones) : row.phones ?? {};
  const clickCounts =
    typeof row.click_counts === "string"
      ? JSON.parse(row.click_counts)
      : row.click_counts ?? {};
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    initialMessage: row.initial_message ?? "",
    botIds: Array.isArray(botIds) ? botIds : [],
    phones: phonesRaw && typeof phonesRaw === "object" ? (phonesRaw as Record<string, string>) : {},
    clickCounts: clickCounts && typeof clickCounts === "object" ? clickCounts : {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

export async function initWaRedirectLinksSchema() {
  if (!useDatabase()) return;
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS wa_redirect_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      initial_message TEXT NOT NULL DEFAULT '',
      bot_ids JSONB NOT NULL DEFAULT '[]',
      click_counts JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS wa_redirect_links_user_idx ON wa_redirect_links (user_id);
    ALTER TABLE wa_redirect_links ADD COLUMN IF NOT EXISTS phones JSONB NOT NULL DEFAULT '{}';
  `);
}

export async function listWaRedirectLinks(userId: string): Promise<WaRedirectLink[]> {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT * FROM wa_redirect_links WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map(rowToLink);
  }
  const store = await loadFile();
  return store.links.filter((l) => l.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getWaRedirectLinkBySlug(slug: string): Promise<WaRedirectLink | null> {
  const normalized = normalizeLinkSlug(slug);
  if (!normalized) return null;
  if (useDatabase()) {
    const { rows } = await getPool().query(`SELECT * FROM wa_redirect_links WHERE slug = $1 LIMIT 1`, [
      normalized
    ]);
    return rows[0] ? rowToLink(rows[0]) : null;
  }
  const store = await loadFile();
  return store.links.find((l) => l.slug === normalized) ?? null;
}

export async function getWaRedirectLinkById(id: string, userId: string): Promise<WaRedirectLink | null> {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT * FROM wa_redirect_links WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [id, userId]
    );
    return rows[0] ? rowToLink(rows[0]) : null;
  }
  const store = await loadFile();
  return store.links.find((l) => l.id === id && l.userId === userId) ?? null;
}

async function slugTaken(slug: string, excludeId?: string): Promise<boolean> {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      excludeId
        ? `SELECT 1 FROM wa_redirect_links WHERE slug = $1 AND id <> $2 LIMIT 1`
        : `SELECT 1 FROM wa_redirect_links WHERE slug = $1 LIMIT 1`,
      excludeId ? [slug, excludeId] : [slug]
    );
    return rows.length > 0;
  }
  const store = await loadFile();
  return store.links.some((l) => l.slug === slug && l.id !== excludeId);
}

export function sanitizeLinkPhones(botIds: string[], phones: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of botIds) {
    const digits = normalizeWaPhone(phones[id] ?? "");
    if (digits) out[id] = digits;
  }
  return out;
}

export function validateLinkTargets(botIds: string[], phones: Record<string, string>) {
  if (botIds.length === 0) throw new Error("Selecione pelo menos uma instância no rodízio.");
  const clean = sanitizeLinkPhones(botIds, phones);
  if (Object.keys(clean).length === 0) {
    throw new Error("Informe o número WhatsApp (com DDI) de pelo menos uma instância marcada.");
  }
  return clean;
}

export async function createWaRedirectLink(input: {
  userId: string;
  name: string;
  slug: string;
  initialMessage?: string;
  botIds: string[];
  phones: Record<string, string>;
}): Promise<WaRedirectLink> {
  const slug = normalizeLinkSlug(input.slug || input.name);
  if (!slug) throw new Error("Slug inválido.");
  if (await slugTaken(slug)) throw new Error("Este slug já está em uso. Escolha outro.");
  const botIds = [...new Set(input.botIds)];
  const phones = validateLinkTargets(botIds, input.phones);

  const now = new Date().toISOString();
  const link: WaRedirectLink = {
    id: randomUUID(),
    userId: input.userId,
    name: input.name.trim() || slug,
    slug,
    initialMessage: (input.initialMessage ?? "").trim(),
    botIds,
    phones,
    clickCounts: {},
    createdAt: now,
    updatedAt: now
  };

  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO wa_redirect_links (id, user_id, name, slug, initial_message, bot_ids, phones, click_counts, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10)`,
      [
        link.id,
        link.userId,
        link.name,
        link.slug,
        link.initialMessage,
        JSON.stringify(link.botIds),
        JSON.stringify(link.phones),
        JSON.stringify(link.clickCounts),
        link.createdAt,
        link.updatedAt
      ]
    );
    return link;
  }

  const store = await loadFile();
  store.links.push(link);
  await saveFile(store);
  return link;
}

export async function updateWaRedirectLink(
  id: string,
  userId: string,
  input: { name: string; slug: string; initialMessage?: string; botIds: string[]; phones: Record<string, string> }
): Promise<WaRedirectLink> {
  const existing = await getWaRedirectLinkById(id, userId);
  if (!existing) throw new Error("Link não encontrado.");
  const slug = normalizeLinkSlug(input.slug || input.name);
  if (!slug) throw new Error("Slug inválido.");
  if (await slugTaken(slug, id)) throw new Error("Este slug já está em uso.");
  const botIds = [...new Set(input.botIds)];
  const phones = validateLinkTargets(botIds, input.phones);

  const updated: WaRedirectLink = {
    ...existing,
    name: input.name.trim() || slug,
    slug,
    initialMessage: (input.initialMessage ?? "").trim(),
    botIds,
    phones,
    updatedAt: new Date().toISOString()
  };

  if (useDatabase()) {
    await getPool().query(
      `UPDATE wa_redirect_links SET name=$1, slug=$2, initial_message=$3, bot_ids=$4::jsonb, phones=$5::jsonb, updated_at=$6 WHERE id=$7 AND user_id=$8`,
      [
        updated.name,
        updated.slug,
        updated.initialMessage,
        JSON.stringify(updated.botIds),
        JSON.stringify(updated.phones),
        updated.updatedAt,
        id,
        userId
      ]
    );
    return updated;
  }

  const store = await loadFile();
  const idx = store.links.findIndex((l) => l.id === id);
  if (idx >= 0) store.links[idx] = updated;
  await saveFile(store);
  return updated;
}

export async function deleteWaRedirectLink(id: string, userId: string) {
  if (useDatabase()) {
    await getPool().query(`DELETE FROM wa_redirect_links WHERE id = $1 AND user_id = $2`, [id, userId]);
    return;
  }
  const store = await loadFile();
  store.links = store.links.filter((l) => !(l.id === id && l.userId === userId));
  await saveFile(store);
}

export async function resetWaRedirectLinkCounts(id: string, userId: string) {
  const existing = await getWaRedirectLinkById(id, userId);
  if (!existing) throw new Error("Link não encontrado.");
  const updatedAt = new Date().toISOString();
  if (useDatabase()) {
    await getPool().query(
      `UPDATE wa_redirect_links SET click_counts='{}'::jsonb, updated_at=$1 WHERE id=$2 AND user_id=$3`,
      [updatedAt, id, userId]
    );
    return;
  }
  const store = await loadFile();
  const link = store.links.find((l) => l.id === id && l.userId === userId);
  if (link) {
    link.clickCounts = {};
    link.updatedAt = updatedAt;
    await saveFile(store);
  }
}

/** Escolhe o número com menos cliques (rodízio justo). */
export function pickBotForRedirect(link: WaRedirectLink): string | null {
  const eligible = link.botIds.filter((id) => Boolean(normalizeWaPhone(link.phones[id] ?? "")));
  if (eligible.length === 0) return null;
  let pick = eligible[0]!;
  let min = link.clickCounts[pick] ?? 0;
  for (const id of eligible) {
    const count = link.clickCounts[id] ?? 0;
    if (count < min) {
      min = count;
      pick = id;
    }
  }
  return pick;
}

export function phoneForBotInLink(link: WaRedirectLink, botId: string): string | null {
  const digits = normalizeWaPhone(link.phones[botId] ?? "");
  return digits || null;
}

export async function recordRedirectClick(linkId: string, botId: string) {
  if (useDatabase()) {
    await getPool().query(
      `UPDATE wa_redirect_links
       SET click_counts = click_counts || jsonb_build_object($2::text, COALESCE((click_counts->>$2)::int, 0) + 1),
           updated_at = NOW()
       WHERE id = $1`,
      [linkId, botId]
    );
    return;
  }
  const store = await loadFile();
  const link = store.links.find((l) => l.id === linkId);
  if (!link) return;
  link.clickCounts[botId] = (link.clickCounts[botId] ?? 0) + 1;
  link.updatedAt = new Date().toISOString();
  await saveFile(store);
}

export function redirectUrl(baseUrl: string, slug: string) {
  return `${baseUrl.replace(/\/$/, "")}/r/${slug}`;
}
