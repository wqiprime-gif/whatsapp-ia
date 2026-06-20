import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config.js";
import { getPool, useDatabase } from "../db/index.js";

import { normalizeWaPhone } from "./wa-links.js";

export type WaRedirectTarget = {
  id: string;
  label: string;
  phone: string;
};

export type WaRedirectLink = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  initialMessage: string;
  /** Números no rodízio — independentes das instâncias. */
  targets: WaRedirectTarget[];
  /** Legado — mantido só para migração. */
  botIds: string[];
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
      links: (data.links ?? []).map((l) => normalizeStoredLink(l))
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

function normalizeStoredLink(raw: Partial<WaRedirectLink> & { id: string; userId: string }): WaRedirectLink {
  const botIds = Array.isArray(raw.botIds) ? raw.botIds : [];
  const phones = raw.phones && typeof raw.phones === "object" ? raw.phones : {};
  const clickCounts = raw.clickCounts && typeof raw.clickCounts === "object" ? raw.clickCounts : {};
  let targets = Array.isArray(raw.targets) ? raw.targets.filter((t) => t && t.phone) : [];

  if (targets.length === 0) {
    for (const [key, val] of Object.entries(phones)) {
      const phone = normalizeWaPhone(val ?? "");
      if (!phone) continue;
      targets.push({
        id: key,
        label: "WhatsApp",
        phone
      });
    }
  }

  targets = targets
    .map((t) => ({
      id: t.id || randomUUID(),
      label: (t.label ?? "").trim() || "WhatsApp",
      phone: normalizeWaPhone(t.phone ?? "")
    }))
    .filter((t) => Boolean(t.phone));

  return {
    id: raw.id,
    userId: raw.userId,
    name: raw.name ?? "",
    slug: raw.slug ?? "",
    initialMessage: raw.initialMessage ?? "",
    targets,
    botIds: [],
    phones: {},
    clickCounts,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString()
  };
}

function rowToLink(row: {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  initial_message: string | null;
  bot_ids?: string[] | string;
  phones?: Record<string, string> | string | null;
  targets?: WaRedirectTarget[] | string | null;
  click_counts: Record<string, number> | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}): WaRedirectLink {
  const botIds = typeof row.bot_ids === "string" ? JSON.parse(row.bot_ids) : row.bot_ids ?? [];
  const phonesRaw =
    typeof row.phones === "string" ? JSON.parse(row.phones) : row.phones ?? {};
  const targetsRaw =
    typeof row.targets === "string" ? JSON.parse(row.targets) : row.targets ?? [];
  const clickCounts =
    typeof row.click_counts === "string"
      ? JSON.parse(row.click_counts)
      : row.click_counts ?? {};
  return normalizeStoredLink({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    initialMessage: row.initial_message ?? "",
    botIds: Array.isArray(botIds) ? botIds : [],
    phones: phonesRaw && typeof phonesRaw === "object" ? (phonesRaw as Record<string, string>) : {},
    targets: Array.isArray(targetsRaw) ? targetsRaw : [],
    clickCounts: clickCounts && typeof clickCounts === "object" ? clickCounts : {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  });
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
    ALTER TABLE wa_redirect_links ADD COLUMN IF NOT EXISTS targets JSONB NOT NULL DEFAULT '[]';
  `);
}

async function persistLink(link: WaRedirectLink) {
  if (useDatabase()) {
    await getPool().query(
      `UPDATE wa_redirect_links SET bot_ids='[]'::jsonb, phones='{}'::jsonb, targets=$1::jsonb, click_counts=$2::jsonb, updated_at=$3 WHERE id=$4`,
      [JSON.stringify(link.targets), JSON.stringify(link.clickCounts), link.updatedAt, link.id]
    );
    return;
  }
  const store = await loadFile();
  const idx = store.links.findIndex((l) => l.id === link.id);
  if (idx >= 0) {
    store.links[idx] = link;
    await saveFile(store);
  }
}

export function sanitizeTargets(targets: WaRedirectTarget[]): WaRedirectTarget[] {
  const out: WaRedirectTarget[] = [];
  const seen = new Set<string>();
  for (const raw of targets) {
    const phone = normalizeWaPhone(raw.phone ?? "");
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push({
      id: raw.id?.trim() || randomUUID(),
      label: (raw.label ?? "").trim() || `Número ${out.length + 1}`,
      phone
    });
  }
  return out;
}

export function validateTargets(targets: WaRedirectTarget[]) {
  const clean = sanitizeTargets(targets);
  if (clean.length === 0) {
    throw new Error("Adicione pelo menos um número WhatsApp com DDI (ex: 5511999999999).");
  }
  return clean;
}

export async function listWaRedirectLinks(userId: string): Promise<WaRedirectLink[]> {
  let links: WaRedirectLink[];
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT * FROM wa_redirect_links WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    links = rows.map(rowToLink);
  } else {
    const store = await loadFile();
    links = store.links
      .filter((l) => l.userId === userId)
      .map(normalizeStoredLink)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  for (const link of links) {
    const normalized = normalizeStoredLink(link);
    if (
      JSON.stringify(normalized.targets) !== JSON.stringify(link.targets) ||
      link.botIds.length > 0 ||
      Object.keys(link.phones).length > 0
    ) {
      normalized.updatedAt = new Date().toISOString();
      await persistLink(normalized);
    }
  }
  return links.map(normalizeStoredLink);
}

export async function getWaRedirectLinkBySlug(slug: string): Promise<WaRedirectLink | null> {
  const normalized = normalizeLinkSlug(slug);
  if (!normalized) return null;
  if (useDatabase()) {
    const { rows } = await getPool().query(`SELECT * FROM wa_redirect_links WHERE slug = $1 LIMIT 1`, [
      normalized
    ]);
    return rows[0] ? normalizeStoredLink(rowToLink(rows[0])) : null;
  }
  const store = await loadFile();
  const link = store.links.find((l) => l.slug === normalized);
  return link ? normalizeStoredLink(link) : null;
}

export async function getWaRedirectLinkById(id: string, userId: string): Promise<WaRedirectLink | null> {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT * FROM wa_redirect_links WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [id, userId]
    );
    return rows[0] ? normalizeStoredLink(rowToLink(rows[0])) : null;
  }
  const store = await loadFile();
  const link = store.links.find((l) => l.id === id && l.userId === userId);
  return link ? normalizeStoredLink(link) : null;
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

/** Remove referências de instância excluída e preserva números como targets manuais. */
export async function pruneRedirectLinksForBot(userId: string, botId: string) {
  const links = await listWaRedirectLinks(userId);
  for (const link of links) {
    let changed = false;
    const next = normalizeStoredLink(link);
    const orphanPhone = normalizeWaPhone(link.phones?.[botId] ?? "");

    if (orphanPhone && !next.targets.some((t) => t.phone === orphanPhone)) {
      next.targets.push({
        id: randomUUID(),
        label: "WhatsApp",
        phone: orphanPhone
      });
      changed = true;
    }

    if (link.botIds?.includes(botId)) changed = true;
    if (link.clickCounts?.[botId] !== undefined) {
      delete next.clickCounts[botId];
      changed = true;
    }

    if (changed) {
      next.updatedAt = new Date().toISOString();
      await persistLink(next);
    }
  }
}

export async function createWaRedirectLink(input: {
  userId: string;
  name: string;
  slug: string;
  initialMessage?: string;
  targets: WaRedirectTarget[];
}): Promise<WaRedirectLink> {
  const slug = normalizeLinkSlug(input.slug || input.name);
  if (!slug) throw new Error("Slug inválido.");
  if (await slugTaken(slug)) throw new Error("Este slug já está em uso. Escolha outro.");
  const targets = validateTargets(input.targets);

  const now = new Date().toISOString();
  const link: WaRedirectLink = {
    id: randomUUID(),
    userId: input.userId,
    name: input.name.trim() || slug,
    slug,
    initialMessage: (input.initialMessage ?? "").trim(),
    targets,
    botIds: [],
    phones: {},
    clickCounts: {},
    createdAt: now,
    updatedAt: now
  };

  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO wa_redirect_links (id, user_id, name, slug, initial_message, bot_ids, phones, targets, click_counts, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'[]'::jsonb,'{}'::jsonb,$6::jsonb,$7::jsonb,$8,$9)`,
      [
        link.id,
        link.userId,
        link.name,
        link.slug,
        link.initialMessage,
        JSON.stringify(link.targets),
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
  input: { name: string; slug: string; initialMessage?: string; targets: WaRedirectTarget[] }
): Promise<WaRedirectLink> {
  const existing = await getWaRedirectLinkById(id, userId);
  if (!existing) throw new Error("Link não encontrado.");
  const slug = normalizeLinkSlug(input.slug || input.name);
  if (!slug) throw new Error("Slug inválido.");
  if (await slugTaken(slug, id)) throw new Error("Este slug já está em uso.");
  const targets = validateTargets(input.targets);

  const updated: WaRedirectLink = {
    ...existing,
    name: input.name.trim() || slug,
    slug,
    initialMessage: (input.initialMessage ?? "").trim(),
    targets,
    botIds: [],
    phones: {},
    updatedAt: new Date().toISOString()
  };

  if (useDatabase()) {
    await getPool().query(
      `UPDATE wa_redirect_links SET name=$1, slug=$2, initial_message=$3, bot_ids='[]'::jsonb, phones='{}'::jsonb, targets=$4::jsonb, updated_at=$5 WHERE id=$6 AND user_id=$7`,
      [
        updated.name,
        updated.slug,
        updated.initialMessage,
        JSON.stringify(updated.targets),
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
export function pickTargetForRedirect(link: WaRedirectLink): WaRedirectTarget | null {
  const targets = sanitizeTargets(link.targets);
  if (targets.length === 0) return null;
  let pick = targets[0]!;
  let min = link.clickCounts[pick.id] ?? 0;
  for (const t of targets) {
    const count = link.clickCounts[t.id] ?? 0;
    if (count < min) {
      min = count;
      pick = t;
    }
  }
  return pick;
}

/** @deprecated use pickTargetForRedirect */
export function pickBotForRedirect(link: WaRedirectLink): string | null {
  return pickTargetForRedirect(link)?.id ?? null;
}

export function phoneForTargetInLink(link: WaRedirectLink, targetId: string): string | null {
  const t = link.targets.find((x) => x.id === targetId);
  const digits = normalizeWaPhone(t?.phone ?? "");
  return digits || null;
}

/** @deprecated */
export function phoneForBotInLink(link: WaRedirectLink, botId: string): string | null {
  return phoneForTargetInLink(link, botId);
}

export async function recordRedirectClick(linkId: string, targetId: string) {
  if (useDatabase()) {
    await getPool().query(
      `UPDATE wa_redirect_links
       SET click_counts = click_counts || jsonb_build_object($2::text, COALESCE((click_counts->>$2)::int, 0) + 1),
           updated_at = NOW()
       WHERE id = $1`,
      [linkId, targetId]
    );
    return;
  }
  const store = await loadFile();
  const link = store.links.find((l) => l.id === linkId);
  if (!link) return;
  link.clickCounts[targetId] = (link.clickCounts[targetId] ?? 0) + 1;
  link.updatedAt = new Date().toISOString();
  await saveFile(store);
}

export function redirectUrl(baseUrl: string, slug: string) {
  return `${baseUrl.replace(/\/$/, "")}/r/${slug}`;
}
