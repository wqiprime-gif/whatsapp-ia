import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config.js";
import { getPool, useDatabase } from "./index.js";

export type CallSessionStatus = "pending" | "accepted" | "declined" | "expired";

export type CallSession = {
  token: string;
  botId: string;
  leadJid: string;
  callerName: string;
  avatarUrl: string;
  videoUrl: string;
  locale: string;
  status: CallSessionStatus;
  expiresAt: string;
  createdAt: string;
};

const dataDir = env.DATA_DIR;
const sessionsFile = path.join(dataDir, "call-sessions.json");

type FileStore = { sessions: CallSession[] };

async function loadFileStore(): Promise<FileStore> {
  try {
    const raw = await fs.readFile(sessionsFile, "utf8");
    return JSON.parse(raw) as FileStore;
  } catch {
    return { sessions: [] };
  }
}

async function saveFileStore(store: FileStore) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(sessionsFile, JSON.stringify(store, null, 2));
}

function newToken() {
  return randomBytes(24).toString("base64url");
}

function isExpired(session: CallSession) {
  return new Date(session.expiresAt).getTime() < Date.now();
}

export async function createCallSession(input: {
  botId?: string;
  leadJid?: string;
  callerName: string;
  avatarUrl: string;
  videoUrl: string;
  locale?: string;
  ttlHours?: number;
}): Promise<CallSession> {
  const token = newToken();
  const ttl = input.ttlHours ?? 48;
  const expiresAt = new Date(Date.now() + ttl * 3600 * 1000).toISOString();
  const session: CallSession = {
    token,
    botId: input.botId || "",
    leadJid: input.leadJid ?? "",
    callerName: input.callerName,
    avatarUrl: input.avatarUrl,
    videoUrl: input.videoUrl,
    locale: input.locale ?? "pt-BR",
    status: "pending",
    expiresAt,
    createdAt: new Date().toISOString()
  };

  if (useDatabase()) {
    await getPool().query(
      `INSERT INTO call_sessions (token, bot_id, lead_jid, caller_name, avatar_url, video_url, locale, status, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        session.token,
        session.botId || null,
        session.leadJid,
        session.callerName,
        session.avatarUrl,
        session.videoUrl,
        session.locale,
        session.status,
        session.expiresAt
      ]
    );
    return session;
  }

  const store = await loadFileStore();
  store.sessions.unshift(session);
  await saveFileStore(store);
  return session;
}

export async function getCallSession(token: string): Promise<CallSession | null> {
  if (useDatabase()) {
    const { rows } = await getPool().query(
      `SELECT token, bot_id, lead_jid, caller_name, avatar_url, video_url, locale, status, expires_at, created_at
       FROM call_sessions WHERE token = $1 LIMIT 1`,
      [token]
    );
    const r = rows[0];
    if (!r) return null;
    const session: CallSession = {
      token: String(r.token),
      botId: String(r.bot_id),
      leadJid: String(r.lead_jid ?? ""),
      callerName: String(r.caller_name ?? ""),
      avatarUrl: String(r.avatar_url ?? ""),
      videoUrl: String(r.video_url ?? ""),
      locale: String(r.locale ?? "pt-BR"),
      status: String(r.status) as CallSessionStatus,
      expiresAt: new Date(r.expires_at).toISOString(),
      createdAt: new Date(r.created_at).toISOString()
    };
    if (isExpired(session) && session.status === "pending") {
      await updateCallSessionStatus(token, "expired");
      session.status = "expired";
    }
    return session;
  }

  const store = await loadFileStore();
  const session = store.sessions.find((s) => s.token === token) ?? null;
  if (!session) return null;
  if (isExpired(session) && session.status === "pending") {
    session.status = "expired";
    await saveFileStore(store);
  }
  return session;
}

export async function updateCallSessionStatus(token: string, status: CallSessionStatus) {
  if (useDatabase()) {
    await getPool().query(`UPDATE call_sessions SET status = $2 WHERE token = $1`, [token, status]);
    return;
  }
  const store = await loadFileStore();
  const session = store.sessions.find((s) => s.token === token);
  if (session) session.status = status;
  await saveFileStore(store);
}

export function buildCallPageUrl(token: string, baseUrl?: string) {
  const base = (baseUrl || env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  return `${base}/call/${token}`;
}
