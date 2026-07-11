import { randomUUID } from "node:crypto";
import { getPool, useDatabase } from "./index.js";

export type CallVideoMeta = {
  id: string;
  mime: string;
  size: number;
};

function mimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".ogg") || lower.endsWith(".ogv")) return "video/ogg";
  return "video/mp4";
}

/** Salva o MP4 da chamada no Postgres (sobrevive a qualquer deploy). Retorna a URL /call-video/:id. */
export async function saveCallVideoToDb(buffer: Buffer, originalName: string): Promise<string> {
  const id = randomUUID();
  const mime = mimeFromName(originalName);
  await getPool().query(
    `INSERT INTO call_videos (id, mime, size, bytes) VALUES ($1, $2, $3, $4)`,
    [id, mime, buffer.length, buffer]
  );
  return `/call-video/${id}`;
}

export async function getCallVideoMeta(id: string): Promise<CallVideoMeta | null> {
  if (!useDatabase()) return null;
  const { rows } = await getPool().query(
    `SELECT id, mime, size FROM call_videos WHERE id = $1 LIMIT 1`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  return { id: String(r.id), mime: String(r.mime || "video/mp4"), size: Number(r.size) };
}

/** Lê um trecho (range) do vídeo direto do banco — evita carregar 80MB por request. */
export async function readCallVideoRange(id: string, start: number, end: number): Promise<Buffer | null> {
  if (!useDatabase()) return null;
  // substring do Postgres é 1-indexed: from start+1 for (end-start+1)
  const length = end - start + 1;
  const { rows } = await getPool().query(
    `SELECT substring(bytes from $2 for $3) AS chunk FROM call_videos WHERE id = $1 LIMIT 1`,
    [id, start + 1, length]
  );
  const r = rows[0];
  if (!r || r.chunk == null) return null;
  return Buffer.isBuffer(r.chunk) ? r.chunk : Buffer.from(r.chunk);
}
