import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config.js";

export const SESSION_COOKIE = "tg_panel_session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

type SessionPayload = {
  exp: number;
  v: number;
  uid: string;
  email: string;
  name: string;
};

function sign(data: string) {
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(data).digest("base64url");
}

export function createSessionToken(user: SessionUser) {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Date.now() + MAX_AGE_MS,
      v: 2,
      uid: user.id,
      email: user.email,
      name: user.name
    } satisfies SessionPayload),
    "utf8"
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function parseSessionToken(token?: string): SessionPayload | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (typeof parsed.exp !== "number" || parsed.exp <= Date.now()) return null;
    if (parsed.v === 2 && parsed.uid) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function getSessionUser(request: FastifyRequest): SessionUser | null {
  const parsed = parseSessionToken(request.cookies[SESSION_COOKIE]);
  if (!parsed?.uid) return null;
  return { id: parsed.uid, email: parsed.email, name: parsed.name };
}

export function isAuthenticated(request: FastifyRequest) {
  return getSessionUser(request) !== null;
}

export function setSessionCookie(reply: FastifyReply, user: SessionUser) {
  reply.setCookie(SESSION_COOKIE, createSessionToken(user), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_MS / 1000
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (isAuthenticated(request)) {
    return true;
  }
  reply.redirect("/login");
  return false;
}

export function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const user = getSessionUser(request);
  if (user) return user;
  reply.redirect("/login");
  return null;
}
