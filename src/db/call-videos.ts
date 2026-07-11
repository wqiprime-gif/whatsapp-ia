import { randomUUID } from "node:crypto";
import { getPool, useDatabase } from "./index.js";

export type CallVideoData = {
  id: string;
  mime: string;
  size: number;
  bytes: Buffer;
};

function mimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".ogg") || lower.endsWith(".ogv")) return "video/ogg";
  return "video/mp4";
}

// Cache em memória do buffer completo (evita reler o BYTEA do Postgres a cada range request).
const cache = new Map<string, CallVideoData>();
const MAX_CACHE_ENTRIES = 2;

function putCache(item: CallVideoData) {
  cache.delete(item.id);
  cache.set(item.id, item);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Salva o MP4 da chamada no Postgres (sobrevive a qualquer deploy). Retorna a URL /call-video/:id. */
export async function saveCallVideoToDb(buffer: Buffer, originalName: string): Promise<string> {
  const id = randomUUID();
  const mime = mimeFromName(originalName);
  await getPool().query(
    `INSERT INTO call_videos (id, mime, size, bytes) VALUES ($1, $2, $3, $4)`,
    [id, mime, buffer.length, buffer]
  );
  putCache({ id, mime, size: buffer.length, bytes: buffer });
  return `/call-video/${id}`;
}

/** Carrega o vídeo inteiro do banco (com cache). O range é fatiado no Node, sem SQL substring. */
export async function getCallVideo(id: string): Promise<CallVideoData | null> {
  if (!useDatabase()) return null;
  const cached = cache.get(id);
  if (cached) {
    // Refresh LRU
    cache.delete(id);
    cache.set(id, cached);
    return cached;
  }
  const { rows } = await getPool().query(
    `SELECT id, mime, size, bytes FROM call_videos WHERE id = $1 LIMIT 1`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  const bytes: Buffer = Buffer.isBuffer(r.bytes) ? r.bytes : Buffer.from(r.bytes);
  const item: CallVideoData = {
    id: String(r.id),
    mime: String(r.mime || "video/mp4"),
    size: Number(r.size) || bytes.length,
    bytes
  };
  putCache(item);
  return item;
}
