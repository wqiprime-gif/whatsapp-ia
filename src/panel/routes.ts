import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { x1GhostSvg } from "./brand-icon.js";
import { x1BlackFaviconSvg } from "./notify-icon.js";
import { renderX1BlackAppIconPng, x1BlackAppIconSvg } from "./whatsapp-app-icon.js";
import { env, rootDir } from "../config.js";
import { useDatabase } from "../db/index.js";
import {
  dashboardStats,
  dashboardStatsForPeriod,
  salesByPeriod,
  chartOptionsForPeriod,
  normalizeDashboardPeriod,
  getLatestSale,
  listLeads,
  listProducts,
  listReceipts,
  listRecentActivity,
  listSales,
  salesByDay,
  messagesByDay,
  salesRankingByBot,
  salesRankingByUser,
  saveProduct,
  syncProductsFromPrompt,
  syncAllProductsFromBots
} from "../db/events.js";
import {
  deleteBot,
  getBotById,
  getBotByIdAny,
  loadBots,
  upsertBot,
  uploadsDir,
  type BotConfig,
  type NamedAudio
} from "../bots.js";
import { applyWaFieldsFromForm, applyAIFieldsFromForm, defaultMetaVerifyToken } from "../lib/wa-bot-fields.js";
import { followUpStepsFromForm } from "../lib/follow-up.js";
import { buildDefaultAudioLibrary, seedAudioPath } from "../lib/seed-audios.js";
import { type BotPlatform } from "../lib/platform-types.js";
import { parseMetaWebhookBody, verifyMetaWebhook } from "../lib/meta-cloud-api.js";
import { sendRemarketingMulti } from "../lib/remarketing.js";
import { authenticateUser, createUser, deletePlatformUser, getUserById, listPlatformUsers, updateUserProfile } from "../db/users.js";
import { isPlatformOwner, resolvePlatformOwnerAccess } from "../lib/settings.js";
import { getNotificationPrefs, saveNotificationPrefs } from "../db/notification-prefs.js";
import { encryptSecret } from "../lib/crypto.js";
import {
  clearSessionCookie,
  getSessionUser,
  isAuthenticated,
  requireUser,
  setSessionCookie
} from "../lib/session.js";
import { generateBotPrompt } from "../lib/prompt-generator.js";
import {
  leadsPage,
  mediaPage,
  paymentsPage,
  productsPage,
  remarketingPage,
  salesChartSvgFromData
} from "./pages.js";
import { messagesChartSvgFromData, sparklineSvg, chartDayValues, conversionGaugeSvg, sharkPerformanceChartHtml } from "./charts.js";
import { giftsPage, mergeGiftItems } from "./gifts-page.js";
import { mergeUpsellRules, saveBotEngagement } from "../lib/bot-engagement.js";
import { waQrPage } from "./wa-qr-page.js";
import { botNeedsMotorRestart, chatIdFromWaJid, getWaLiveStatuses, getWaPhonesForBots, pickDistributionPhone, purgeWaInstanceData, readWaQr, waPortForBot } from "../whatsapp-runtime.js";
import { buildWaMeUrl } from "../lib/wa-links.js";
import { buildPwaManifest, SERVICE_WORKER_JS } from "./pwa.js";
import {
  buildCallPageUrl,
  createCallSession,
  getCallSession,
  updateCallSessionStatus
} from "../db/call-sessions.js";
import {
  addPanelNotification,
  clearPanelNotifications,
  listPanelNotifications
} from "../db/panel-notifications.js";
import {
  saveCallVideoToDb,
  getCallVideo
} from "../db/call-videos.js";
import { renderCallPage } from "./call-page.js";
import { logMessage, logReceipt, logSale, upsertLead } from "../db/events.js";
import {
  activityFeedHtml,
  activeInstancesCardHtml,
  dashboardPage,
  formatRelativeTime,
  instancesPage,
  loginPage,
  editInstancePage,
  newInstancePage,
  registerPage,
  profilePage,
  topBotsRankingHtml,
  topPlayersRankingHtml
} from "./ui.js";
import { waLinksPage } from "./links-page.js";
import { adminUsersPage } from "./admin-users-page.js";
import {
  chipWarmerDashboardPage,
  chipWarmerNewPage,
  chipWarmerSessionPage,
  adminWarmOverviewPage
} from "./chip-warmer-page.js";
import {
  createWarmSession,
  getBotWarmScores,
  getWarmSession,
  listWarmSessions,
  listActiveWarmSessions,
  setWarmSessionStatus,
  countPlatformWarmingChips,
  countWarmingChipsByUser
} from "../lib/chip-warmer.js";
import { discoverCommonGroupsForBots } from "../lib/chip-warmer-scheduler.js";
import {
  createWaRedirectLink,
  deleteWaRedirectLink,
  getWaRedirectLinkBySlug,
  listWaRedirectLinks,
  pickTargetForRedirect,
  phoneForTargetInLink,
  pruneRedirectLinksForBot,
  recordRedirectClick,
  resetWaRedirectLinkCounts,
  updateWaRedirectLink,
  type WaRedirectTarget
} from "../lib/wa-redirect-links.js";
import { panelUserLabel } from "./layout.js";

async function rowsForUser<T extends Record<string, unknown>>(rows: T[], userId: string) {
  const ids = new Set((await loadBots(userId)).map((b) => b.id));
  return rows.filter((r) => ids.has(String(r.bot_id ?? r.botId ?? "")));
}

async function panelUserMeta(userId: string) {
  const full = await getUserById(userId);
  const showAdminNav = await resolvePlatformOwnerAccess(userId);
  return {
    label: panelUserLabel({
      name: full?.name ?? "",
      username: full?.username,
      email: full?.email
    }),
    avatarUrl: full?.avatarUrl ?? "",
    showAdminNav
  };
}

const AVATAR_MAX_DATA_BYTES = 3_000_000;

async function saveProfileAvatar(file: AsyncIterable<Buffer>, originalName: string) {
  const chunks: Buffer[] = [];
  for await (const chunk of file) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  const ext = path.extname(originalName).toLowerCase();
  const mime =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  if (buf.length > 0 && buf.length <= AVATAR_MAX_DATA_BYTES) {
    return `data:${mime};base64,${buf.toString("base64")}`;
  }
  await fs.mkdir(uploadsDir, { recursive: true });
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const fileName = `${Date.now()}-${randomUUID()}-${safeName}`;
  const filePath = path.join(uploadsDir, fileName);
  await fs.writeFile(filePath, buf);
  return `/uploads/${fileName}`;
}

async function parseProfileMultipart(request: FastifyRequest) {
  const fields: Record<string, string> = {};
  let avatarUrl = "";
  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (!part.filename || part.fieldname !== "avatarFile") continue;
      avatarUrl = await saveProfileAvatar(part.file, part.filename);
      continue;
    }
    fields[part.fieldname] = String(part.value || "");
  }
  return { fields, avatarUrl };
}

async function saveUploadedFile(file: AsyncIterable<Buffer>, originalName: string) {
  await fs.mkdir(uploadsDir, { recursive: true });
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const fileName = `${Date.now()}-${randomUUID()}-${safeName}`;
  const filePath = path.join(uploadsDir, fileName);
  const chunks: Buffer[] = [];
  for await (const chunk of file) chunks.push(chunk);
  await fs.writeFile(filePath, Buffer.concat(chunks));
  return `/uploads/${fileName}`;
}

/**
 * Salva o vídeo da chamada no banco (BYTEA) quando há Postgres — sobrevive a deploy.
 * Sem banco (dev local), cai para arquivo em /uploads.
 */
async function saveCallVideoUpload(file: AsyncIterable<Buffer>, originalName: string) {
  const chunks: Buffer[] = [];
  for await (const chunk of file) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  if (useDatabase() && buf.length > 0) {
    return saveCallVideoToDb(buf, originalName);
  }
  await fs.mkdir(uploadsDir, { recursive: true });
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const fileName = `${Date.now()}-${randomUUID()}-${safeName}`;
  await fs.writeFile(path.join(uploadsDir, fileName), buf);
  return `/uploads/${fileName}`;
}

/** Converte /uploads/ em data URL para persistir no Postgres e sobreviver deploy. */
async function normalizeAvatarForStorage(url: string): Promise<string> {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/uploads/")) {
    const fileName = path.basename(trimmed);
    const filePath = path.join(uploadsDir, fileName);
    try {
      const buf = await fs.readFile(filePath);
      if (buf.length > 0 && buf.length <= AVATAR_MAX_DATA_BYTES) {
        return `data:${mimeTypeFromPath(filePath)};base64,${buf.toString("base64")}`;
      }
    } catch {
      /* arquivo sumiu após deploy — mantém URL original */
    }
  }
  return trimmed;
}

async function parseBotMultipart(request: FastifyRequest) {
  const fields: Record<string, string> = {};
  const fieldArrays: Record<string, string[]> = {};
  const previewUploads: string[] = [];
  const deliveryUploads: string[] = [];
  let newNamedAudioUrl = "";
  let priceTableUpload = "";
  let callVideoUpload = "";
  let callAvatarUpload = "";
  const audioReplacements: Record<number, string> = {};
  const seedAudioReplacements: Record<string, string> = {};

  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (!part.filename) continue;
      if (part.fieldname === "callAvatarFile") {
        callAvatarUpload = await saveProfileAvatar(part.file, part.filename);
        continue;
      }
      if (part.fieldname === "callVideoFile") {
        callVideoUpload = await saveCallVideoUpload(part.file, part.filename);
        continue;
      }
      const url = await saveUploadedFile(part.file, part.filename);
      if (
        part.fieldname === "previewFiles" ||
        part.fieldname === "previewAudioFiles"
      ) {
        previewUploads.push(url);
      }
      if (
        part.fieldname === "deliveryFiles" ||
        part.fieldname === "deliveryAudioFiles"
      ) {
        deliveryUploads.push(url);
      }
      if (part.fieldname === "newAudioFile") newNamedAudioUrl = url;
      if (part.fieldname === "priceTableImage") priceTableUpload = url;
      if (part.fieldname === "callAvatarFile") callAvatarUpload = url;
      const replaceMatch = /^replaceAudioFile_(\d+)$/.exec(part.fieldname);
      if (replaceMatch) {
        audioReplacements[Number(replaceMatch[1])] = url;
      }
      const seedMatch = /^seedAudioFile_(.+)$/.exec(part.fieldname);
      if (seedMatch) {
        seedAudioReplacements[seedMatch[1]] = url;
      }
      continue;
    }
    const key = part.fieldname;
    const value = String(part.value || "");
    (fieldArrays[key] ||= []).push(value);
    if (key === "removeAudioIndexes" || key === "removePreviewIndexes") {
      const prev = fields[key] ? `${fields[key]},` : "";
      fields[key] = `${prev}${value}`;
    } else {
      fields[key] = value;
    }
  }

  return {
    fields,
    fieldArrays,
    previewUploads,
    deliveryUploads,
    newNamedAudioUrl,
    priceTableUpload,
    callVideoUpload,
    callAvatarUpload,
    audioReplacements,
    seedAudioReplacements
  };
}

/** Resolve a URL final da imagem da tabela: upload novo, remoção, ou mantém a atual. */
function resolvePriceTableImageUrl(
  existing: string | undefined,
  fields: Record<string, string>,
  uploaded: string
): string {
  if (fields.removePriceTableImage === "1") return "";
  if (uploaded) return uploaded;
  return existing ?? "";
}

function resolveCallVideoUrl(
  existing: string | undefined,
  fields: Record<string, string>,
  uploaded: string
): string {
  if (fields.removeCallVideo === "1") return "";
  if (uploaded) return uploaded;
  return existing ?? "";
}

function resolveCallAvatarUrl(
  existing: string | undefined,
  fields: Record<string, string>,
  uploaded: string
): string {
  if (fields.removeCallAvatar === "1") return "";
  if (uploaded) return uploaded;
  const fromField = String(fields.videoCallAvatarUrl || "").trim();
  if (fromField) return fromField;
  return existing ?? "";
}

function mergeAudioLibrary(
  existing: NamedAudio[],
  fields: Record<string, string>,
  newUrl: string,
  replacements: Record<number, string> = {}
): NamedAudio[] {
  let library = existing.map((item, index) => {
    const nextUrl = replacements[index];
    if (!nextUrl) return item;
    return { ...item, url: nextUrl };
  });
  const removeRaw = fields.removeAudioIndexes || "";
  const removeSet = new Set(
    removeRaw
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n))
  );
  library = library.filter((_, index) => !removeSet.has(index));

  const label = fields.newAudioLabel?.trim();
  if (label && newUrl) {
    const triggers = (fields.newAudioTriggers || fields.newAudioKeywords)?.trim();
    const slug = fields.newAudioSlug?.trim();
    library.push({
      label,
      url: newUrl,
      slug: slug || undefined,
      triggers: triggers || undefined,
      keywords: triggers || undefined
    });
  }

  return library;
}

async function applySeedAudioReplacements(
  library: NamedAudio[],
  replacements: Record<string, string>
): Promise<NamedAudio[]> {
  if (!replacements || Object.keys(replacements).length === 0) return library;
  return library.map((item) => {
    const slug = item.slug || "";
    if (slug && replacements[slug]) return { ...item, url: replacements[slug] };
    return item;
  });
}

function mergePreviewUrls(
  existing: string[],
  fields: Record<string, string>,
  uploads: string[]
) {
  const removeRaw = fields.removePreviewIndexes || "";
  const removeSet = new Set(
    removeRaw
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n))
  );
  const kept = existing.filter((_, index) => !removeSet.has(index));
  return [...kept, ...uploads];
}

function mergeDeliveryUrls(
  existing: string[],
  fields: Record<string, string>,
  uploads: string[]
) {
  const removeRaw = fields.removeDeliveryIndexes || "";
  const removeSet = new Set(
    removeRaw
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n))
  );
  const kept = existing.filter((_, index) => !removeSet.has(index));
  return [...kept, ...uploads];
}

const botFormFieldsSchema = z.object({
  name: z.string().min(1),
  token: z.string().optional(),
  platform: z.enum(["whatsapp", "telegram"]).default("whatsapp"),
  tgApiId: z.string().optional(),
  tgApiHash: z.string().optional(),
  tgPhone: z.string().optional(),
  waPhoneNumber: z.string().optional(),
  prompt: z.string().min(1),
  pixKey: z.string().default(""),
  pixRecipientName: z.string().optional(),
  messageDelayMinutes: z.coerce.number().min(0).max(30).default(0),
  messageDelaySeconds: z.coerce.number().min(0).max(59).default(4),
  active: z.enum(["true", "false"]).default("true"),
  paymentMethod: z.enum(["pix", "laranjinha"]).default("pix"),
  laranjinhaApiKey: z.string().optional(),
  backupToken: z.string().optional(),
  productName: z.string().default("VIP"),
  productPrice: z.coerce.number().default(97),
  deliveryLink: z.string().default(""),
  videoCallLink: z.string().default(""),
  videoCallCallerName: z.string().default(""),
  videoCallAvatarUrl: z.string().default(""),
  locale: z.enum(["pt-BR", "en-US"]).default("pt-BR"),
  waApiProvider: z.enum(["whatsapp_web", "meta_cloud"]).default("whatsapp_web"),
  proxyEnabled: z.enum(["true", "false"]).default("false"),
  proxyType: z.enum(["http", "https", "socks5", "socks5h"]).default("http"),
  proxyHost: z.string().optional(),
  proxyPort: z.string().optional(),
  proxyUsername: z.string().optional(),
  proxyPassword: z.string().optional(),
  proxyUrl: z.string().optional(),
  metaPhoneNumberId: z.string().optional(),
  metaAccessToken: z.string().optional(),
  metaVerifyToken: z.string().optional(),
  followUpEnabled: z.enum(["true", "false"]).default("true"),
  followUpAfterMinutes: z.coerce.number().min(1).max(180).default(10),
  followUpMaxPerLead: z.coerce.number().min(1).max(5).default(2),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
  aiApiKey: z.string().optional()
});

function applyTelegramFieldsFromForm<T extends Record<string, unknown>>(
  bot: T,
  body: {
    platform?: string;
    tgApiId?: string;
    tgApiHash?: string;
    tgPhone?: string;
  }
): T {
  const platform = body.platform === "telegram" ? "telegram" : "whatsapp";
  const next = { ...bot, platform } as T & {
    tgApiId?: number;
    tgApiHashEncrypted?: string;
    tgPhone?: string;
    token?: string;
    id?: string;
  };
  if (platform === "telegram") {
    const apiId = Number(String(body.tgApiId || "").trim());
    if (Number.isFinite(apiId) && apiId > 0) next.tgApiId = apiId;
    const hash = String(body.tgApiHash || "").trim();
    if (hash) next.tgApiHashEncrypted = encryptSecret(hash);
    if (body.tgPhone !== undefined) next.tgPhone = String(body.tgPhone || "").trim();
    if (next.id && (!next.token || String(next.token).startsWith("wa-"))) {
      next.token = `tg-${next.id}`;
    }
  }
  return next;
}

function messageDelayMsFromForm(input: { messageDelayMinutes: number; messageDelaySeconds: number }) {
  const totalSeconds = input.messageDelayMinutes * 60 + input.messageDelaySeconds;
  return Math.max(1500, totalSeconds * 1000);
}

async function ensureInstanceAIKey(
  _user: { id: string; email: string },
  body: { aiApiKey?: string },
  existing?: { aiApiKeyEncrypted?: string }
) {
  if (body.aiApiKey?.trim() || existing?.aiApiKeyEncrypted) return;
  throw new Error("Informe a API Key da IA nesta instância.");
}

function mimeTypeFromPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if ([".jpg", ".jpeg"].includes(ext)) return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mp3") return "audio/mpeg";
  return "application/octet-stream";
}

function flashRedirect(path: string, message: string, type: "ok" | "err" = "ok") {
  return `${path}?${new URLSearchParams({ msg: message, t: type }).toString()}`;
}

function parseFormTargets(body: Record<string, unknown>): WaRedirectTarget[] {
  const indices = new Set<number>();
  for (const key of Object.keys(body)) {
    const m = key.match(/^target_phone_(\d+)$/);
    if (m) indices.add(Number(m[1]));
  }
  const sorted = [...indices].sort((a, b) => a - b);
  const targets: WaRedirectTarget[] = [];
  for (const i of sorted) {
    const phone = String(body[`target_phone_${i}`] ?? "").trim();
    const label = String(body[`target_label_${i}`] ?? "").trim();
    const id = String(body[`target_id_${i}`] ?? "").trim();
    if (!phone) continue;
    targets.push({ id, label, phone });
  }
  return targets;
}

function errorMessage(error: unknown) {
  if (error instanceof z.ZodError) return error.issues.map((i) => i.message).join(", ");
  if (error instanceof Error) return error.message;
  return "Erro desconhecido.";
}

function isPartial(request: FastifyRequest) {
  return request.headers["x-panel-partial"] === "1";
}

async function requirePlatformOwner(
  request: FastifyRequest,
  reply: import("fastify").FastifyReply
) {
  const user = requireUser(request, reply);
  if (!user) return null;
  const full = await getUserById(user.id);
  if (!isPlatformOwner({ email: full?.email ?? user.email, username: full?.username })) {
    reply.redirect(flashRedirect("/", "Acesso restrito ao administrador da plataforma.", "err"));
    return null;
  }
  return user;
}

export async function registerPanelRoutes(
  app: FastifyInstance,
  hooks: {
    restartBots: () => void;
    restartBot: (botId: string) => void;
    ensureBots: () => void;
    syncBots: () => void;
  }
) {
  await app.register(cookie);

  app.addHook("onSend", async (_request, reply, payload) => {
    const ct = String(reply.getHeader("content-type") || "");
    if (ct.includes("text/html")) {
      reply.header("content-type", "text/html; charset=utf-8");
      reply.header("vary", "X-Panel-Partial");
    }
    return payload;
  });

  app.addHook("onRequest", async (request, reply) => {
    const urlPath = request.url.split("?")[0];
    const publicPaths = [
      "/login",
      "/register",
      "/uploads",
      "/health",
      "/brand",
      "/internal",
      "/webhooks",
      "/manifest.webmanifest",
      "/sw.js",
      "/favicon.ico",
      "/call",
      "/call-assets"
    ];
    if (publicPaths.some((p) => urlPath === p || urlPath.startsWith(`${p}/`))) return;
    if (!isAuthenticated(request)) return reply.redirect("/login");

    if (useDatabase()) {
      const sessionUser = getSessionUser(request);
      if (sessionUser) {
        const { getUserById } = await import("../db/users.js");
        const dbUser = await getUserById(sessionUser.id);
        if (!dbUser) {
          clearSessionCookie(reply);
          return reply.redirect(
            "/login?msg=Sua+sessao+expirou.+Entre+novamente+com+seu+usuario+e+senha."
          );
        }
      }
    }
  });

  app.get("/health", async (_request, reply) => {
    const { APP_VERSION } = await import("../version.js");
    return reply
      .type("application/json")
      .send({
        ok: true,
        version: APP_VERSION,
        channel: "whatsapp",
        database: useDatabase(),
        mode: useDatabase() ? "postgres" : "files"
      });
  });

  app.get("/webhooks/meta/:botId", async (request, reply) => {
    const params = z.object({ botId: z.string().min(1) }).parse(request.params);
    const query = z
      .object({
        "hub.mode": z.string().optional(),
        "hub.verify_token": z.string().optional(),
        "hub.challenge": z.string().optional()
      })
      .parse(request.query);

    const bot = await getBotByIdAny(params.botId);
    if (!bot?.active || bot.waApiProvider !== "meta_cloud") {
      return reply.code(404).send("Bot não encontrado.");
    }

    const challenge = verifyMetaWebhook({
      mode: query["hub.mode"],
      token: query["hub.verify_token"],
      challenge: query["hub.challenge"],
      expectedToken: bot.metaVerifyToken || ""
    });
    if (challenge === null) return reply.code(403).send("Verify token inválido.");
    return reply.type("text/plain").send(challenge);
  });

  app.post("/webhooks/meta/:botId", async (request, reply) => {
    const params = z.object({ botId: z.string().min(1) }).parse(request.params);
    const bot = await getBotByIdAny(params.botId);
    if (!bot?.active || bot.waApiProvider !== "meta_cloud") {
      return reply.code(404).send({ ok: false });
    }

    const messages = parseMetaWebhookBody(request.body);
    for (const msg of messages) {
      const chatId = chatIdFromWaJid(`${msg.from}@c.us`);
      await upsertLead({ botId: bot.id, chatId, displayName: msg.from });
      await logMessage({ botId: bot.id, chatId, role: "user", content: msg.text });
    }
    return reply.send({ ok: true });
  });

  app.post("/internal/validate-receipt", async (request, reply) => {
    if (request.headers["x-internal"] !== env.INTERNAL_SECRET) {
      return reply.code(401).send({ ok: false });
    }
    try {
      const body = z
        .object({
          botId: z.string().min(1),
          base64: z.string().min(1),
          mimetype: z.string().default("image/jpeg"),
          filename: z.string().optional()
        })
        .parse(request.body ?? {});

      const bot = await getBotByIdAny(body.botId);
      if (!bot) {
        return reply.code(404).send({ ok: false, error: "Instancia nao encontrada" });
      }

      const { validateReceiptFromImage } = await import("../lib/receipt-validator.js");
      const { formatReceiptOutcome } = await import("../lib/receipt-messages.js");

      const { validateReceiptFromPdf } = await import("../lib/pdf-receipt.js");
      const { personaReceiptRejection } = await import("../lib/receipt-persona.js");

      const ctx = {
        pixKey: bot.pixKey,
        recipientName: bot.pixRecipientName || bot.name,
        expectedAmountCents: bot.productPriceCents,
        userId: bot.userId
      };

      const isPdf =
        body.mimetype.includes("pdf") || /\.pdf$/i.test(body.filename || "");

      let result;
      if (isPdf) {
        const buffer = Buffer.from(body.base64, "base64");
        result = await validateReceiptFromPdf({ buffer, ...ctx });
      } else {
        const dataUrl = `data:${body.mimetype || "image/jpeg"};base64,${body.base64}`;
        result = await validateReceiptFromImage({ imageUrl: dataUrl, ...ctx });
      }

      let outcomeMessage = formatReceiptOutcome(result, result.userMessage);
      if (!result.paid) {
        outcomeMessage = await personaReceiptRejection({
          config: bot,
          reason: result.reason,
          userMessage: result.userMessage
        });
      }

      return reply.send({
        ok: true,
        paid: result.paid,
        confidence: result.confidence,
        reason: result.reason,
        userMessage: result.userMessage,
        outcomeMessage
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        ok: false,
        paid: false,
        confidence: 0,
        reason: error instanceof Error ? error.message : "Erro ao validar comprovante",
        outcomeMessage: "amor, travou aqui… manda o comprovante de novo? 😘"
      });
    }
  });

  app.post("/internal/tg-session-backup", async (request, reply) => {
    if (request.headers["x-internal"] !== env.INTERNAL_SECRET) {
      return reply.code(401).send({ ok: false });
    }
    try {
      const body = z
        .object({
          botId: z.string().uuid(),
          session: z.string().min(16)
        })
        .parse(request.body ?? {});

      const bot = await getBotByIdAny(body.botId);
      if (!bot) {
        return reply.code(404).send({ ok: false, error: "Instancia nao encontrada" });
      }

      const { saveTgSessionBackup } = await import("../db/tg-session.js");
      await saveTgSessionBackup(body.botId, body.session);
      console.log(`[tg] 💾 Backup sessão ${bot.name} salvo no PostgreSQL`);
      return reply.send({ ok: true });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao salvar backup da sessao Telegram"
      });
    }
  });

  app.post("/internal/wa-session-backup", { bodyLimit: 100 * 1024 * 1024 }, async (request, reply) => {
    if (request.headers["x-internal"] !== env.INTERNAL_SECRET) {
      return reply.code(401).send({ ok: false });
    }
    try {
      const isRaw = String(request.headers["content-type"] || "").includes("application/octet-stream");
      let botId: string;
      let clientId: string;
      let data: Buffer;

      if (isRaw) {
        botId = z.string().uuid().parse(request.headers["x-bot-id"]);
        clientId = z.string().min(1).parse(request.headers["x-client-id"]);
        data = Buffer.isBuffer(request.body) ? request.body : Buffer.from(request.body as string);
      } else {
        const body = z
          .object({
            botId: z.string().uuid(),
            clientId: z.string().min(1),
            base64: z.string().min(1)
          })
          .parse(request.body ?? {});
        botId = body.botId;
        clientId = body.clientId;
        data = Buffer.from(body.base64, "base64");
      }

      const bot = await getBotByIdAny(botId);
      if (!bot) {
        return reply.code(404).send({ ok: false, error: "Instancia nao encontrada" });
      }

      if (data.length < 32) {
        return reply.code(400).send({ ok: false, error: "Backup vazio ou invalido" });
      }
      if (data.length > 80 * 1024 * 1024) {
        return reply.code(413).send({ ok: false, error: "Backup excede 80MB" });
      }

      const { saveWaSessionBackup } = await import("../db/wa-session.js");
      await saveWaSessionBackup(botId, data, clientId);
      console.log(
        `[wa-web] 💾 Backup sessão ${bot.name} salvo no PostgreSQL (${Math.round(data.length / 1024)} KB)`
      );
      return reply.send({ ok: true, bytes: data.length });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao salvar backup da sessao"
      });
    }
  });

  app.get("/internal/conversation-history", async (request, reply) => {
    if (request.headers["x-internal"] !== env.INTERNAL_SECRET) {
      return reply.code(401).send({ ok: false });
    }
    try {
      const q = z
        .object({
          botId: z.string().min(1),
          chatId: z.coerce.number(),
          limit: z.coerce.number().min(1).max(80).optional()
        })
        .parse(request.query ?? {});

      const { getConversationMessages } = await import("../db/events.js");
      const messages = await getConversationMessages(q.botId, q.chatId, q.limit ?? 36);
      return reply.send({ ok: true, messages });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao carregar historico"
      });
    }
  });

  app.get("/internal/lead-state", async (request, reply) => {
    if (request.headers["x-internal"] !== env.INTERNAL_SECRET) {
      return reply.code(401).send({ ok: false });
    }
    try {
      const q = z
        .object({
          botId: z.string().min(1),
          chatId: z.coerce.number()
        })
        .parse(request.query ?? {});

      const { getLeadState } = await import("../db/lead-state-db.js");
      const state = await getLeadState(q.botId, q.chatId);
      return reply.send({ ok: true, state });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao carregar lead state"
      });
    }
  });

  app.patch("/internal/lead-state", async (request, reply) => {
    if (request.headers["x-internal"] !== env.INTERNAL_SECRET) {
      return reply.code(401).send({ ok: false });
    }
    try {
      const body = z
        .object({
          botId: z.string().min(1),
          chatId: z.coerce.number(),
          patch: z.record(z.string(), z.unknown()).optional(),
          approach: z.string().optional(),
          approachConverted: z.boolean().optional()
        })
        .parse(request.body ?? {});

      const { patchLeadState, recordFunnelApproach } = await import("../db/lead-state-db.js");
      const patch = (body.patch ?? {}) as import("../db/lead-state-db.js").LeadStatePatch;
      const state = await patchLeadState(body.botId, body.chatId, patch);

      if (body.approach) {
        await recordFunnelApproach(
          body.botId,
          body.chatId,
          body.approach,
          Boolean(body.approachConverted)
        );
      }

      return reply.send({ ok: true, state });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao salvar lead state"
      });
    }
  });

  app.post("/internal/events", async (request, reply) => {
    if (request.headers["x-internal"] !== env.INTERNAL_SECRET) {
      return reply.code(401).send({ ok: false });
    }
    try {
      const body = z
        .object({
          type: z.enum(["lead", "message", "sale", "receipt"]),
          botId: z.string().min(1),
          jid: z.string().optional(),
          chatId: z.coerce.number().optional(),
          role: z.string().optional(),
          content: z.string().optional(),
          displayName: z.string().optional(),
          source: z.string().optional(),
          paid: z.boolean().optional(),
          confidence: z.coerce.number().optional(),
          reason: z.string().optional(),
          fileUrl: z.string().optional(),
          fileType: z.string().optional(),
          productName: z.string().optional(),
          amountCents: z.coerce.number().optional(),
          paymentMethod: z.string().optional()
        })
        .parse(request.body ?? {});

      const chatId = body.chatId ?? (body.jid ? chatIdFromWaJid(body.jid) : 0);
      if (!chatId) {
        request.log.warn({ body }, "internal/events: chatId invalido");
        return reply.send({ ok: false, error: "chatId invalido" });
      }

      if (body.type === "lead") {
        const leadResult = await upsertLead({
          botId: body.botId,
          chatId,
          displayName: body.displayName,
          source: body.source
        });
        request.log.info(
          { botId: body.botId, chatId, displayName: body.displayName, isNew: leadResult.isNew },
          "lead registrado"
        );
        if (leadResult.isNew) {
          const leadBot = await getBotByIdAny(body.botId);
          if (leadBot?.userId) {
            const prefs = await getNotificationPrefs(leadBot.userId);
            if (prefs.enabled && prefs.leads) {
              const who = body.displayName || `Chat ${chatId}`;
              const subtitle = `${who} · ${leadBot.name}`;
              await addPanelNotification({
                userId: leadBot.userId,
                id: `lead-${leadResult.id || `${body.botId}-${chatId}`}`,
                kind: "lead",
                title: "Nova conversa",
                subtitle
              }).catch(() => null);
              const { notifyUserPush } = await import("../lib/web-push.js");
              void notifyUserPush(leadBot.userId, {
                title: "Nova conversa",
                body: subtitle,
                url: "/",
                tag: `lead-${leadResult.id || `${body.botId}-${chatId}`}`
              }).catch(() => {});
            }
          }
        }
      } else if (body.type === "message" && body.content) {
        await logMessage({
          botId: body.botId,
          chatId,
          role: (body.role as "user" | "assistant" | "system") ?? "user",
          content: body.content
        });
      } else if (body.type === "sale") {
        const saleId = await logSale({
          botId: body.botId,
          chatId,
          productName: body.productName ?? "VIP",
          amountCents: body.amountCents ?? 0,
          paymentMethod: (body.paymentMethod as "pix" | "laranjinha") ?? "pix"
        });
        const saleBot = await getBotByIdAny(body.botId);
        if (saleBot?.userId) {
          const prefs = await getNotificationPrefs(saleBot.userId);
          if (prefs.enabled && prefs.sales) {
            const reais = ((body.amountCents ?? 0) / 100).toFixed(2).replace(".", ",");
            const { notifyUserPush } = await import("../lib/web-push.js");
            void notifyUserPush(saleBot.userId, {
              title: `Venda: R$ ${reais}`,
              body: body.productName ?? "VIP",
              url: "/",
              tag: saleId ? `sale-${saleId}` : `sale-${body.botId}-${Date.now()}`
            }).catch(() => {});
          }
        }
        if (saleBot?.postSaleEnabled) {
          const { schedulePostSaleJob } = await import("../lib/post-sale-scheduler.js");
          await schedulePostSaleJob({
            botId: saleBot.id,
            chatId,
            waitDays: saleBot.postSaleWaitDays ?? 2
          });
        }
      } else if (body.type === "receipt") {
        await logReceipt({
          botId: body.botId,
          chatId,
          fileUrl: body.fileUrl,
          fileType: body.fileType,
          paid: body.paid ?? false,
          confidence: body.confidence ?? 0,
          reason: body.reason ?? ""
        });
        if (body.paid) {
          const receiptBot = await getBotByIdAny(body.botId);
          if (receiptBot?.userId) {
            const prefs = await getNotificationPrefs(receiptBot.userId);
            if (prefs.enabled && prefs.sales) {
              const subtitle = `Pix validado · ${receiptBot.name}`;
              const { notifyUserPush } = await import("../lib/web-push.js");
              void notifyUserPush(receiptBot.userId, {
                title: "Pagamento confirmado",
                body: subtitle,
                url: "/",
                tag: `receipt-${body.botId}-${chatId}-${Date.now()}`
              }).catch(() => {});
            }
          }
        }
      }
      return reply.send({ ok: true });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ ok: false });
    }
  });

  app.post("/internal/call-sessions", async (request, reply) => {
    if (request.headers["x-internal"] !== env.INTERNAL_SECRET) {
      return reply.code(401).send({ ok: false });
    }
    try {
      const body = z
        .object({
          botId: z.string().min(1),
          leadJid: z.string().optional(),
          jid: z.string().optional()
        })
        .parse(request.body ?? {});

      const bot = await getBotByIdAny(body.botId);
      if (!bot) return reply.code(404).send({ ok: false, error: "Bot não encontrado" });

      const videoUrl = String(bot.videoCallVideoUrl || "").trim();
      if (!videoUrl) {
        const fallback = String(bot.videoCallLink || "").trim();
        if (!fallback) return reply.code(400).send({ ok: false, error: "Vídeo da chamada não configurado" });
        return reply.send({ ok: true, url: fallback, external: true });
      }

      const session = await createCallSession({
        botId: bot.id,
        leadJid: body.leadJid || body.jid || "",
        callerName: bot.videoCallCallerName?.trim() || bot.name,
        avatarUrl: await normalizeAvatarForStorage(bot.videoCallAvatarUrl || bot.avatarUrl || ""),
        videoUrl,
        locale: bot.locale || "pt-BR"
      });
      const url = buildCallPageUrl(session.token);
      return reply.send({ ok: true, url, token: session.token, external: false });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: error instanceof Error ? error.message : "Erro" });
    }
  });

  app.post("/api/panel/call-preview", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const body = z
        .object({
          botId: z.string().optional(),
          callerName: z.string().optional(),
          videoUrl: z.string().optional(),
          avatarUrl: z.string().optional(),
          locale: z.enum(["pt-BR", "en-US"]).optional()
        })
        .parse(request.body ?? {});

      let videoUrl = String(body.videoUrl || "").trim();
      let callerName = String(body.callerName || "").trim();
      let avatarUrl = String(body.avatarUrl || "").trim();
      let locale = body.locale === "en-US" ? "en-US" : "pt-BR";
      let botId = body.botId || "";

      if (botId) {
        const bot = await getBotById(botId, user.id);
        if (!bot) return reply.code(404).send({ ok: false, error: "Instância não encontrada" });
        videoUrl = videoUrl || bot.videoCallVideoUrl || "";
        callerName = callerName || bot.videoCallCallerName || bot.name;
        avatarUrl = avatarUrl || bot.videoCallAvatarUrl || bot.avatarUrl || "";
        locale = bot.locale === "en-US" ? "en-US" : locale;
      }

      if (!videoUrl) {
        return reply.code(400).send({
          ok: false,
          error: "Selecione o vídeo MP4 da chamada (ou salve a instância com o vídeo) antes de gerar o link."
        });
      }

      // Se o vídeo salvo era um arquivo em /uploads e sumiu (deploy limpou o disco),
      // avisa para reenviar em vez de gerar um link que abre com tela preta.
      if (videoUrl.startsWith("/uploads/")) {
        const videoPath = path.join(uploadsDir, path.basename(videoUrl));
        const exists = await fs.access(videoPath).then(() => true).catch(() => false);
        if (!exists) {
          return reply.code(400).send({
            ok: false,
            error: "O vídeo salvo não está mais disponível no servidor. Reenvie o MP4 e gere o link novamente."
          });
        }
      }

      avatarUrl = await normalizeAvatarForStorage(avatarUrl);

      if (botId && avatarUrl) {
        const bot = await getBotById(botId, user.id);
        if (bot && bot.videoCallAvatarUrl !== avatarUrl) {
          await upsertBot({ ...bot, videoCallAvatarUrl: avatarUrl });
        }
      }

      const session = await createCallSession({
        botId: botId || undefined,
        leadJid: "preview-test",
        callerName: callerName || "X1 BLACK",
        avatarUrl,
        videoUrl,
        locale
      });
      const url = buildCallPageUrl(session.token);
      return reply.send({ ok: true, url, token: session.token });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: errorMessage(error) });
    }
  });

  app.post("/api/panel/call-video-upload", { bodyLimit: 100 * 1024 * 1024 }, async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      let videoUrl = "";
      for await (const part of request.parts()) {
        if (part.type === "file" && part.filename) {
          videoUrl = await saveCallVideoUpload(part.file, part.filename);
          break;
        }
      }
      if (!videoUrl) {
        return reply.code(400).send({ ok: false, error: "Envie um arquivo de vídeo MP4." });
      }
      return reply.send({ ok: true, videoUrl });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: errorMessage(error) });
    }
  });

  app.post("/api/panel/call-avatar-upload", { bodyLimit: 8 * 1024 * 1024 }, async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      let avatarUrl = "";
      for await (const part of request.parts()) {
        if (part.type === "file" && part.filename) {
          avatarUrl = await saveProfileAvatar(part.file, part.filename);
          break;
        }
      }
      if (!avatarUrl) {
        return reply.code(400).send({ ok: false, error: "Envie uma foto de perfil (JPG/PNG/WebP)." });
      }
      return reply.send({ ok: true, avatarUrl });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: errorMessage(error) });
    }
  });

  app.post("/api/panel/bell", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const body = z
        .object({
          id: z.string().optional(),
          kind: z.string().optional(),
          title: z.string().min(1),
          subtitle: z.string().optional()
        })
        .parse(request.body ?? {});
      const item = await addPanelNotification({
        userId: user.id,
        id: body.id,
        kind: body.kind,
        title: body.title,
        subtitle: body.subtitle
      });
      if (!item) {
        return reply.send({ ok: true, skipped: true });
      }
      return reply.send({
        ok: true,
        item: {
          id: item.id,
          kind: item.kind,
          title: item.title,
          subtitle: item.subtitle,
          time: formatRelativeTime(item.at),
          at: item.at
        }
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ ok: false, error: errorMessage(error) });
    }
  });

  app.delete("/api/panel/bell", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    await clearPanelNotifications(user.id);
    return reply.send({ ok: true });
  });

  app.get("/call-assets/ringtone.mp3", async (_request, reply) => {
    const filePath = seedAudioPath("chamadavideo.mp3");
    if (!filePath) return reply.code(404).send("Audio nao encontrado.");
    return reply.type("audio/mpeg").send(fsSync.createReadStream(filePath));
  });

  app.get("/call/:token", async (request, reply) => {
    const params = z.object({ token: z.string().min(8) }).parse(request.params);
    const session = await getCallSession(params.token);
    if (!session) return reply.code(404).type("text/html").send(renderCallPage({
      token: params.token,
      callerName: "",
      avatarUrl: "",
      videoUrl: "",
      locale: "pt-BR",
      status: "expired"
    }));
    return reply.type("text/html").send(renderCallPage({
      token: session.token,
      callerName: session.callerName,
      avatarUrl: session.avatarUrl,
      videoUrl: session.videoUrl,
      locale: session.locale,
      status: session.status
    }));
  });

  app.post("/call/:token/accept", async (request, reply) => {
    const params = z.object({ token: z.string().min(8) }).parse(request.params);
    const session = await getCallSession(params.token);
    if (!session || session.status === "expired") {
      return reply.code(404).send({ ok: false });
    }
    await updateCallSessionStatus(params.token, "accepted");
    return reply.send({ ok: true, videoUrl: session.videoUrl });
  });

  app.post("/call/:token/decline", async (request, reply) => {
    const params = z.object({ token: z.string().min(8) }).parse(request.params);
    await updateCallSessionStatus(params.token, "declined");
    return reply.send({ ok: true });
  });

  app.post("/call/:token/end", async (request, reply) => {
    const params = z.object({ token: z.string().min(8) }).parse(request.params);
    await updateCallSessionStatus(params.token, "ended");
    return reply.send({ ok: true });
  });

  app.get("/login", async (request, reply) => {
    if (isAuthenticated(request)) return reply.redirect("/");
    const query = z.object({ msg: z.string().optional() }).parse(request.query);
    return reply.type("text/html").send(loginPage(query.msg ?? ""));
  });

  app.get("/register", async (request, reply) => {
    if (isAuthenticated(request)) return reply.redirect("/");
    return reply.type("text/html").send(registerPage());
  });

  app.post("/register", async (request, reply) => {
    try {
      const body = z
        .object({
          name: z.string().min(2),
          username: z.string().min(3).max(32),
          email: z.string().email(),
          password: z.string().min(6),
          inviteCode: z.string().optional()
        })
        .parse(request.body);
      if (body.inviteCode?.trim() !== env.INVITE_CODE) {
        throw new Error("Codigo de convite invalido.");
      }
      const user = await createUser(body);
      setSessionCookie(reply, user);
      return reply.redirect("/");
    } catch (error) {
      return reply
        .code(400)
        .type("text/html")
        .send(registerPage(errorMessage(error)));
    }
  });

  app.post("/login", async (request, reply) => {
    const body = z
      .object({
        username: z.string().min(3).max(32),
        password: z.string().min(1)
      })
      .parse(request.body);
    const user = await authenticateUser(body.username, body.password);
    if (!user) {
      return reply.code(401).type("text/html").send(loginPage("Usuário ou senha incorretos."));
    }
    setSessionCookie(reply, user);
    return reply.redirect("/");
  });

  app.post("/logout", async (_request, reply) => {
    clearSessionCookie(reply);
    return reply.redirect("/login");
  });

  app.get("/", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    const bots = await loadBots(user.id);
    const statuses = await getWaLiveStatuses(bots);
    const partial = isPartial(request);
    const meta = await panelUserMeta(user.id);
    const full = await getUserById(user.id);
    const period = normalizeDashboardPeriod("hoje");
    const html = dashboardPage(
      bots,
      {
        stats: await dashboardStatsForPeriod(period, user.id),
        chart: await salesByPeriod(period, user.id),
        messagesChart: await messagesByDay(7, user.id),
        activities: await listRecentActivity(8, user.id),
        topBots: await salesRankingByBot(5, user.id),
        topPlayers: await salesRankingByUser(5)
      },
      query.msg,
      query.t === "err",
      partial,
      meta.label,
      statuses,
      user.id,
      meta.avatarUrl,
      user.email,
      full?.name ?? "",
      meta.showAdminNav
    );
    return reply.type("text/html").send(html);
  });

  app.get("/api/panel/avatar", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const full = await getUserById(user.id);
    const url = full?.avatarUrl?.trim() ?? "";
    if (!url) return reply.code(404).send();

    if (url.startsWith("data:")) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return reply.code(404).send();
      const buf = Buffer.from(match[2]!, "base64");
      return reply
        .type(match[1]!)
        .header("Cache-Control", "private, max-age=300")
        .send(buf);
    }

    if (url.startsWith("/uploads/")) {
      const fileName = path.basename(url.split("?")[0]!);
      const filePath = path.join(uploadsDir, fileName);
      try {
        await fs.access(filePath);
      } catch {
        return reply.code(404).send();
      }
      return reply
        .type(mimeTypeFromPath(filePath))
        .header("Cache-Control", "private, max-age=300")
        .send(fsSync.createReadStream(filePath));
    }

    if (url.startsWith("http")) {
      return reply.redirect(url);
    }

    return reply.code(404).send();
  });

  app.get("/api/panel/me", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const full = await getUserById(user.id);
    const label = panelUserLabel({
      name: full?.name ?? "",
      username: full?.username,
      email: full?.email ?? user.email
    });
    const notificationPrefs = await getNotificationPrefs(user.id);
    return reply.send({
      name: full?.name ?? "",
      username: full?.username ?? "",
      email: full?.email ?? user.email,
      label,
      avatarUrl: full?.avatarUrl ?? "",
      notificationPrefs,
      isPlatformOwner: await resolvePlatformOwnerAccess(user.id)
    });
  });

  app.get("/api/panel/sale-ping", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const latestSale = await getLatestSale(user.id);
    return reply.send({
      latestSale: latestSale
        ? {
            id: latestSale.id,
            subtitle: latestSale.subtitle,
            amountCents: latestSale.amountCents,
            productName: latestSale.productName
          }
        : null,
      latestSaleAt: latestSale?.at ?? null
    });
  });

  app.get("/api/panel/live", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z.object({ period: z.string().optional() }).parse(request.query);
    const period = normalizeDashboardPeriod(query.period);
    const bots = await loadBots(user.id);
    const statuses = await getWaLiveStatuses(bots);
    const stats = await dashboardStatsForPeriod(period, user.id);
    const chart = await salesByPeriod(period, user.id);
    const chartOpts = chartOptionsForPeriod(period);
    const messagesChart = await messagesByDay(7, user.id);
    const activities = await listRecentActivity(8, user.id);
    const topBots = await salesRankingByBot(5, user.id);
    const topPlayers = await salesRankingByUser(5);
    const latestSale = await getLatestSale(user.id);
    const recentSales = await listSales(8, user.id);
    const todayStats = await dashboardStatsForPeriod("hoje", user.id);
    const panelBell = await listPanelNotifications(user.id, 24);

    const activityTitles: Record<string, string> = {
      sale: "Venda aprovada",
      lead: "Nova conversa",
      receipt: "Pagamento confirmado"
    };

    const activityBell = activities.map((a) => ({
      id: a.id,
      saleId: a.type === "sale" ? a.id : undefined,
      kind: a.type,
      title: activityTitles[a.type] ?? a.title,
      subtitle: a.subtitle,
      amountCents: a.type === "sale" ? a.amountCents : undefined,
      time: formatRelativeTime(a.at),
      at: a.at
    }));

    const extraBell = panelBell.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      subtitle: n.subtitle,
      time: formatRelativeTime(n.at),
      at: n.at
    }));

    const bellItems = [...extraBell, ...activityBell]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 16);

    const bellSales = recentSales.map((row) => {
      const s = row as Record<string, unknown>;
      const product = String(s.product_name ?? s.productName ?? "Produto");
      const cents = Number(s.amount_cents ?? s.amountCents ?? 0);
      const botName = String(s.bot_name ?? "Bot");
      const at = String(s.created_at ?? s.createdAt ?? new Date().toISOString());
      const reais = (cents / 100).toFixed(2).replace(".", ",");
      return {
        title: "Venda confirmada",
        subtitle: `${product} · R$ ${reais} · ${botName}`,
        time: formatRelativeTime(at)
      };
    });

    const convPct = stats.leads > 0 ? (stats.salesCount / stats.leads) * 100 : 0;
    const ticketMedioCents =
      stats.salesCount > 0 ? Math.round(stats.salesTotalCents / stats.salesCount) : 0;
    const fatGoal = 10_000;
    const fatProgress = Math.min(100, Math.round((stats.salesTotalCents / 100 / fatGoal) * 100));

    const periodLabels: Record<string, string> = {
      hoje: "Hoje",
      ontem: "Ontem",
      "7d": "Últimos 7 dias",
      "30d": "Últimos 30 dias",
      total: "Total"
    };

    const chartFingerprint =
      period +
      "|" +
      chart.map((p) => `${p.day}:${p.totalCents}`).join(",") +
      "|" +
      chartOpts.dayCount +
      "|" +
      (chartOpts.endOffset ?? 0);

    return reply.send({
      period,
      periodLabel: periodLabels[period] ?? "Hoje",
      stats: {
        leads: stats.leads,
        salesTotalCents: stats.salesTotalCents,
        salesCount: stats.salesCount,
        messagesToday: stats.messagesToday,
        activeBots: bots.filter((b) => b.active).length,
        connectedBots: bots.filter(
          (b) => statuses[b.id] === "connected" || statuses[b.id] === "meta_ready"
        ).length,
        ticketMedioCents,
        fatProgress,
        convRate:
          stats.leads > 0
            ? ((stats.salesCount / stats.leads) * 100).toFixed(1).replace(".", ",")
            : "0,0"
      },
      activityHtml: activityFeedHtml(activities),
      instancesHtml: activeInstancesCardHtml(bots, statuses),
      topBotsHtml: topBotsRankingHtml(topBots),
      topPlayersHtml: topPlayersRankingHtml(topPlayers, user.id),
      chartSvg: sharkPerformanceChartHtml(chart, chartOpts),
      convGaugeHtml: conversionGaugeSvg(convPct, `${stats.salesCount} pagos de ${stats.leads} leads`),
      messagesChartSvg: messagesChartSvgFromData(messagesChart),
      sparkSalesHtml: sparklineSvg(chartDayValues(chart, (p) => p.totalCents / 100)),
      sparkMessagesHtml: sparklineSvg(chartDayValues(messagesChart, (p) => p.count), "#e5e5e5"),
      latestSale: latestSale
        ? {
            id: latestSale.id,
            subtitle: latestSale.subtitle,
            amountCents: latestSale.amountCents,
            productName: latestSale.productName
          }
        : null,
      latestSaleAt: latestSale?.at ?? null,
      bellItems,
      bellSales,
      waStatuses: statuses,
      botNames: Object.fromEntries(bots.map((b) => [b.id, b.name])),
      todayStats: {
        salesTotalCents: todayStats.salesTotalCents,
        salesCount: todayStats.salesCount
      },
      chartFingerprint
    });
  });

  app.get("/leads", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const meta = await panelUserMeta(user.id);
    const botIds = (await loadBots(user.id)).map((b) => b.id);
    const { listLeadsWithFunnelState } = await import("../db/lead-state-db.js");
    const rows = botIds.length ? await listLeadsWithFunnelState(200, botIds) : [];
    const html = leadsPage(
      rows,
      isPartial(request),
      meta.showAdminNav,
      meta.label,
      meta.avatarUrl
    );
    return reply.type("text/html").send(html);
  });

  app.get("/manifest.webmanifest", async (request, reply) => {
    const base = (env.PUBLIC_BASE_URL || `${request.protocol}://${request.hostname}`).replace(/\/$/, "");
    return reply
      .type("application/manifest+json; charset=utf-8")
      .header("Cache-Control", "public, max-age=300")
      .send(JSON.stringify(buildPwaManifest(base)));
  });

  app.get("/sw.js", async (_request, reply) => {
    return reply
      .header("Service-Worker-Allowed", "/")
      .header("Cache-Control", "no-cache")
      .type("application/javascript; charset=utf-8")
      .send(SERVICE_WORKER_JS);
  });

  app.get("/favicon.ico", async (_request, reply) => {
    const png = path.join(rootDir, "public", "brand", "onlychat.png");
    if (fsSync.existsSync(png)) {
      return reply.type("image/png").send(fsSync.createReadStream(png));
    }
    return reply.redirect("/brand/favicon.svg");
  });

  // Favicon X1 BLACK — fantasma dourado sem caixa preta.
  app.get("/brand/favicon.svg", async (_request, reply) => {
    return reply
      .type("image/svg+xml")
      .header("Cache-Control", "no-cache")
      .send(x1BlackFaviconSvg());
  });

  // Logo oficial: render metalico do fantasma, com o vetor como reserva.
  app.get("/brand/x1black-ghost.png", async (_request, reply) => {
    const file = path.join(rootDir, "public", "brand", "x1black-ghost.png");
    if (fsSync.existsSync(file)) {
      return reply
        .type("image/png")
        .header("Cache-Control", "public, max-age=604800")
        .send(fsSync.createReadStream(file));
    }
    return reply.type("image/svg+xml").send(x1GhostSvg(512, "", "logo"));
  });

  app.get("/brand/x1black-logo.jpg", async (_request, reply) => {
    const file = path.join(rootDir, "public", "brand", "x1black-logo.jpg");
    if (fsSync.existsSync(file)) {
      return reply
        .type("image/jpeg")
        .header("Cache-Control", "public, max-age=604800")
        .send(fsSync.createReadStream(file));
    }
    return reply.type("image/svg+xml").send(x1GhostSvg(512, "", "logo"));
  });

  app.get("/brand/onlychat-mark.svg", async (_request, reply) => {
    const file = path.join(rootDir, "public", "brand", "onlychat-mark.svg");
    if (fsSync.existsSync(file)) {
      return reply.type("image/svg+xml").send(fsSync.createReadStream(file));
    }
    return reply.code(404).send("Not found");
  });

  app.get("/brand/onlychat.svg", async (_request, reply) => {
    const file = path.join(rootDir, "public", "brand", "onlychat.svg");
    if (fsSync.existsSync(file)) {
      return reply.type("image/svg+xml").send(fsSync.createReadStream(file));
    }
    return reply.type("image/svg+xml").send(x1GhostSvg(120, "", "file"));
  });

  app.get("/brand/onlychat.png", async (_request, reply) => {
    const candidates = [
      path.join(rootDir, "public", "brand", "onlychat.png"),
      path.join(rootDir, "hotbot", "logoo.png")
    ];
    for (const file of candidates) {
      if (fsSync.existsSync(file)) {
        return reply.type("image/png").send(fsSync.createReadStream(file));
      }
    }
    return reply.type("image/svg+xml").send(x1GhostSvg(120, "", "png"));
  });

  app.get("/brand/whatsapp-logo.svg", async (_request, reply) => {
    return reply.type("image/svg+xml").send(x1BlackAppIconSvg(48));
  });

  app.get("/brand/pwa-192.png", async (_request, reply) => {
    const file = path.join(rootDir, "public", "brand", "pwa-192.png");
    if (fsSync.existsSync(file)) {
      return reply
        .type("image/png")
        .header("Cache-Control", "no-cache")
        .send(fsSync.createReadStream(file));
    }
    const buf = await renderX1BlackAppIconPng(192);
    return reply
      .type("image/png")
      .header("Cache-Control", "no-cache")
      .send(buf);
  });

  app.get("/brand/pwa-512.png", async (_request, reply) => {
    const file = path.join(rootDir, "public", "brand", "pwa-512.png");
    if (fsSync.existsSync(file)) {
      return reply
        .type("image/png")
        .header("Cache-Control", "no-cache")
        .send(fsSync.createReadStream(file));
    }
    const buf = await renderX1BlackAppIconPng(512);
    return reply
      .type("image/png")
      .header("Cache-Control", "no-cache")
      .send(buf);
  });

  app.get("/api/push/vapid-public-key", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { getVapidPublicKey, isWebPushConfigured } = await import("../lib/web-push.js");
    return reply.send({
      ok: true,
      configured: isWebPushConfigured(),
      publicKey: getVapidPublicKey()
    });
  });

  app.post("/api/push/subscribe", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const body = z
        .object({
          endpoint: z.string().url(),
          keys: z.object({
            p256dh: z.string().min(1),
            auth: z.string().min(1)
          })
        })
        .parse(request.body ?? {});
      const { savePushSubscription } = await import("../lib/web-push.js");
      await savePushSubscription(user.id, body);
      return reply.send({ ok: true });
    } catch (error) {
      return reply.code(400).send({ ok: false, error: errorMessage(error) });
    }
  });

  app.post("/api/push/test", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const { sendTestPush, isWebPushConfigured } = await import("../lib/web-push.js");
      if (!isWebPushConfigured()) {
        return reply.code(503).send({
          ok: false,
          error: "Configure VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no Railway."
        });
      }
      const result = await sendTestPush(user.id);
      return reply.send({ ok: true, ...result });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: errorMessage(error) });
    }
  });

  app.get("/instances/:id/qr", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const bot = await getBotById(params.id, user.id);
    if (!bot) return reply.redirect(flashRedirect("/instances", "Instância não encontrada.", "err"));
    if (bot.platform === "telegram") {
      return reply.redirect(`/instances/${bot.id}/tg`);
    }
    return reply.type("text/html").send(waQrPage(bot, isPartial(request), panelUserLabel(user)));
  });

  app.get("/instances/:id/tg", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const bot = await getBotById(params.id, user.id);
    if (!bot) return reply.redirect(flashRedirect("/instances", "Instância não encontrada.", "err"));
    if (bot.active) {
      const { getTelegramLiveStatus, restartSingleTelegramBot } = await import("../telegram-runtime.js");
      const st = getTelegramLiveStatus(bot.id);
      if (st === "offline" || st === "error") {
        void restartSingleTelegramBot(bot.id).catch((err) =>
          console.error(`[tg] auto-start ${bot.id}:`, err)
        );
      }
    }
    const { telegramLoginPage } = await import("./tg-login-page.js");
    return reply.type("text/html").send(telegramLoginPage(bot, panelUserLabel(user), isPartial(request)));
  });

  app.post("/api/instances/:id/tg/start", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const bot = await getBotById(params.id, user.id);
    if (!bot) return reply.code(404).send({ ok: false, error: "Instância não encontrada" });
    if (!bot.active) {
      return reply.code(400).send({ ok: false, error: "Ative a instância antes de conectar o Telegram." });
    }
    hooks.restartBot(bot.id);
    const { getTelegramLiveStatus } = await import("../telegram-runtime.js");
    return reply.send({ ok: true, state: getTelegramLiveStatus(bot.id) });
  });

  app.get("/api/instances/:id/tg", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const bot = await getBotById(params.id, user.id);
    if (!bot) return reply.code(404).send({ ok: false });
    const { getTelegramStatusPayload } = await import("../telegram-runtime.js");
    return reply.send(await getTelegramStatusPayload(bot.id));
  });

  app.post("/api/instances/:id/tg/code", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = z.object({ code: z.string().min(3) }).parse(request.body ?? {});
      const bot = await getBotById(params.id, user.id);
      if (!bot) return reply.code(404).send({ ok: false, error: "Instância não encontrada" });
      const { submitTelegramCode } = await import("../telegram-runtime.js");
      await submitTelegramCode(bot.id, body.code);
      return reply.send({ ok: true });
    } catch (error) {
      return reply.code(400).send({ ok: false, error: errorMessage(error) });
    }
  });

  app.post("/api/instances/:id/tg/password", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = z.object({ password: z.string().min(1) }).parse(request.body ?? {});
      const bot = await getBotById(params.id, user.id);
      if (!bot) return reply.code(404).send({ ok: false, error: "Instância não encontrada" });
      const { submitTelegramPassword } = await import("../telegram-runtime.js");
      await submitTelegramPassword(bot.id, body.password);
      return reply.send({ ok: true });
    } catch (error) {
      return reply.code(400).send({ ok: false, error: errorMessage(error) });
    }
  });

  app.post("/instances/:id/tg/restart", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const bot = await getBotById(params.id, user.id);
    if (!bot) return reply.redirect(flashRedirect("/instances", "Instância não encontrada.", "err"));
    hooks.restartBot(bot.id);
    return reply.redirect(flashRedirect(`/instances/${bot.id}/tg`, "Motor Telegram reiniciando..."));
  });

  app.post("/instances/:id/tg/logout", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const bot = await getBotById(params.id, user.id);
    if (!bot) return reply.redirect(flashRedirect("/instances", "Instância não encontrada.", "err"));
    const { logoutTelegramSession } = await import("../telegram-runtime.js");
    await logoutTelegramSession(bot.id);
    hooks.restartBot(bot.id);
    return reply.redirect(flashRedirect(`/instances/${bot.id}/tg`, "Sessão Telegram encerrada."));
  });

  app.get("/api/instances/:id/qr", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const bot = await getBotById(params.id, user.id);
    if (!bot) return reply.code(404).send({ qr: null, connected: false });
    const data = await readWaQr(bot.id);
    return reply.send(data);
  });

  app.get("/audios", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const bots = await loadBots(user.id);
    const query = z.object({ botId: z.string().optional() }).parse(request.query);
    const botId = query.botId || bots[0]?.id;
    if (botId) {
      return reply.redirect(`/instances/${botId}/edit#audios-funil`);
    }
    return reply.redirect("/instances/new#audios-funil");
  });

  app.post("/audios", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    let botId = "";
    try {
      const { fields, newNamedAudioUrl, audioReplacements } = await parseBotMultipart(request);
      botId = fields.botId?.trim() || "";
      if (!botId) throw new Error("Instância não informada.");
      const bot = await getBotById(botId, user.id);
      if (!bot) throw new Error("Instância não encontrada.");

      const library = mergeAudioLibrary(bot.audioLibrary ?? [], fields, newNamedAudioUrl, audioReplacements);
      await upsertBot({ ...bot, audioLibrary: library });
      hooks.syncBots();
      return reply.redirect(
        flashRedirect(`/instances/${botId}/edit#audios-funil`, "Biblioteca de áudios atualizada!")
      );
    } catch (error) {
      request.log.error(error);
      const target = botId ? `/instances/${botId}/edit#audios-funil` : "/instances/new#audios-funil";
      return reply.redirect(
        flashRedirect(target, `Erro: ${errorMessage(error)}`, "err")
      );
    }
  });

  app.get("/gifts", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z
      .object({ botId: z.string().optional(), msg: z.string().optional(), t: z.string().optional() })
      .parse(request.query);
    const bots = await loadBots(user.id);
    const botId = query.botId || bots[0]?.id || "";
    const showAdminNav = await resolvePlatformOwnerAccess(user.id);
    const html = giftsPage(bots, botId, query.msg, query.t === "err", isPartial(request), showAdminNav);
    return reply.type("text/html").send(html);
  });

  app.post("/gifts", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    let botId = "";
    try {
      const raw = (request.body ?? {}) as Record<string, string | string[]>;
      botId = String(raw.botId || "").trim();
      if (!botId) throw new Error("Instância não informada.");
      const bot = await getBotById(botId, user.id);
      if (!bot) throw new Error("Instância não encontrada.");
      const giftItems = mergeGiftItems(bot.giftItems ?? [], raw);
      const giftPrompt = String(raw.giftPrompt || "").trim();
      const upsellRules = mergeUpsellRules(bot.upsellRules ?? [], raw);
      await saveBotEngagement(botId, {
        giftPrompt,
        giftItems,
        postSaleEnabled: raw.postSaleEnabled === "on" || raw.postSaleEnabled === "true",
        postSaleWaitDays: Math.min(7, Math.max(1, Number(raw.postSaleWaitDays) || 2)),
        postSaleOpenerPrompt: String(raw.postSaleOpenerPrompt || "").trim(),
        postSaleWarmupReplies: Math.min(5, Math.max(1, Number(raw.postSaleWarmupReplies) || 2)),
        postSaleGiftDelayMinutes: Math.min(240, Math.max(5, Number(raw.postSaleGiftDelayMinutes) || 45)),
        upsellEnabled: raw.upsellEnabled === "on" || raw.upsellEnabled === "true",
        upsellDelayMinutes: Math.min(60, Math.max(0, Number(raw.upsellDelayMinutes) || 2)),
        upsellInPostSale: raw.upsellInPostSale !== "off" && raw.upsellInPostSale !== "false",
        upsellPrompt: String(raw.upsellPrompt || "").trim(),
        upsellRules
      });
      hooks.syncBots();
      return reply.redirect(flashRedirect(`/gifts?botId=${botId}`, "Presentes atualizados!"));
    } catch (error) {
      request.log.error(error);
      return reply.redirect(
        flashRedirect(`/gifts?botId=${botId}`, `Erro: ${errorMessage(error)}`, "err")
      );
    }
  });

  app.get("/remarketing", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z
      .object({
        botIds: z.union([z.string(), z.array(z.string())]).optional(),
        audience: z.enum(["all", "no_purchase"]).optional(),
        msg: z.string().optional(),
        t: z.string().optional()
      })
      .parse(request.query);
    const bots = await loadBots(user.id);
    const selectedBotIds = Array.isArray(query.botIds)
      ? query.botIds.filter(Boolean)
      : query.botIds
        ? query.botIds.split(",").filter(Boolean)
        : [];
    const audience = query.audience === "all" ? "all" : "no_purchase";
    const { listLeadsByBots, listLeadsWithoutPurchase } = await import("../db/events.js");
    const { listScheduledCampaigns } = await import("../lib/scheduled-campaigns.js");
    const leads =
      selectedBotIds.length === 0
        ? []
        : audience === "no_purchase"
          ? await listLeadsWithoutPurchase(selectedBotIds)
          : await listLeadsByBots(selectedBotIds);
    const leadCountAll =
      selectedBotIds.length > 0 ? (await listLeadsByBots(selectedBotIds)).length : 0;
    const leadCountNoPurchase =
      selectedBotIds.length > 0 ? (await listLeadsWithoutPurchase(selectedBotIds)).length : 0;
    const scheduled = await listScheduledCampaigns(user.id);
    const showAdminNav = await resolvePlatformOwnerAccess(user.id);
    const html = remarketingPage(
      bots,
      selectedBotIds,
      leads,
      scheduled,
      query.msg,
      query.t === "err",
      isPartial(request),
      audience,
      leadCountAll,
      leadCountNoPurchase,
      showAdminNav
    );
    return reply.type("text/html").send(html);
  });

  app.post("/remarketing", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const raw = (request.body ?? {}) as Record<string, string | string[]>;
      const botIdsRaw = raw.botIds;
      const botIds = (Array.isArray(botIdsRaw) ? botIdsRaw : botIdsRaw ? [botIdsRaw] : [])
        .map(String)
        .filter(Boolean);
      if (botIds.length === 0) throw new Error("Selecione ao menos uma instância.");

      const sequence = Object.entries(raw)
        .filter(([key]) => /^seq_\d+$/.test(key))
        .sort(([a], [b]) => Number(a.slice(4)) - Number(b.slice(4)))
        .flatMap(([, v]) => (Array.isArray(v) ? v : [v]))
        .map((v) => String(v || "").trim())
        .filter(Boolean);
      const seqDelayMs = Math.max(0, Number(String(raw.seqDelaySec ?? "8")) * 1000);
      const audience = String(raw.audience || "no_purchase") === "all" ? "all" : "no_purchase";
      const randomize = String(raw.randomize || "") === "true";
      const randomDelayMinMs = Math.max(0, Number(String(raw.randomDelayMinSec ?? "8")) * 1000);
      const randomDelayMaxMs = Math.max(randomDelayMinMs, Number(String(raw.randomDelayMaxSec ?? "25")) * 1000);

      const activeBots: BotConfig[] = [];
      const messagesByBot = new Map<string, { chatId: number; message: string }[]>();

      for (const botId of botIds) {
        const bot = await getBotById(botId, user.id);
        if (!bot) continue;
        if (!bot.active) {
          return reply.redirect(flashRedirect("/remarketing", `Instância ${bot.name} está pausada.`, "err"));
        }
        activeBots.push(bot);
        const messages = Object.entries(raw)
          .filter(([key]) => key.startsWith(`msg_${botId}_`))
          .map(([key, value]) => ({
            chatId: Number(key.slice(`msg_${botId}_`.length)),
            message: String(Array.isArray(value) ? value[0] : value || "").trim()
          }))
          .filter((m) => Number.isFinite(m.chatId) && m.message.length > 0);
        messagesByBot.set(botId, messages);
      }

      if (activeBots.length === 0) {
        return reply.redirect(flashRedirect("/remarketing", "Nenhuma instância válida.", "err"));
      }

      if (sequence.length === 0) {
        const anyPersonal = [...messagesByBot.values()].some((m) => m.length > 0);
        if (!anyPersonal) {
          return reply.redirect(
            flashRedirect("/remarketing", "Preencha a sequência ou mensagens por lead.", "err")
          );
        }
      }

      const sendMode = String(raw.sendMode || "now");
      const ids = botIds.join(",");
      const messagesByBotObj: Record<string, { chatId: number; message: string }[]> = {};
      for (const [botId, msgs] of messagesByBot.entries()) {
        messagesByBotObj[botId] = msgs;
      }

      if (sendMode === "schedule") {
        const scheduledAtRaw = String(raw.scheduledAtIso || raw.scheduledAt || "").trim();
        if (!scheduledAtRaw) {
          return reply.redirect(flashRedirect("/remarketing?botIds=" + ids, "Informe data e hora do agendamento.", "err"));
        }
        const scheduledAt = new Date(scheduledAtRaw);
        if (Number.isNaN(scheduledAt.getTime())) {
          return reply.redirect(flashRedirect("/remarketing?botIds=" + ids, "Data/hora inválida.", "err"));
        }
        if (scheduledAt.getTime() <= Date.now() + 30_000) {
          return reply.redirect(
            flashRedirect("/remarketing?botIds=" + ids, "Agende para pelo menos 1 minuto no futuro.", "err")
          );
        }
        const { createScheduledCampaign } = await import("../lib/scheduled-campaigns.js");
        await createScheduledCampaign({
          userId: user.id,
          botIds,
          sequence,
          sequenceDelayMs: seqDelayMs,
          messagesByBot: messagesByBotObj,
          scheduledAt: scheduledAt.toISOString(),
          audience,
          randomize,
          randomDelayMinMs,
          randomDelayMaxMs
        });
        return reply.redirect(
          flashRedirect(
            `/remarketing?botIds=${ids}`,
            `Campanha agendada para ${scheduledAt.toLocaleString("pt-BR")}.`
          )
        );
      }

      const result = await sendRemarketingMulti({
        bots: activeBots,
        messagesByBot,
        sequence,
        sequenceDelayMs: seqDelayMs,
        audience,
        randomize,
        randomDelayMinMs,
        randomDelayMaxMs
      });
      return reply.redirect(
        flashRedirect(
          `/remarketing?botIds=${ids}`,
          `Remarketing: ${result.sent} enviada(s), ${result.failed} falha(s), ${result.skipped} sem mensagem, de ${result.total} lead(s).`
        )
      );
    } catch (error) {
      request.log.error(error);
      return reply.redirect(flashRedirect("/remarketing", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/remarketing/cancel", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const raw = (request.body ?? {}) as { id?: string };
    const id = String(raw.id || "").trim();
    if (id) {
      const { cancelScheduledCampaign } = await import("../lib/scheduled-campaigns.js");
      await cancelScheduledCampaign(id, user.id);
    }
    return reply.redirect(flashRedirect("/remarketing", "Agendamento cancelado."));
  });

  app.get("/payments", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const html = paymentsPage(
      await rowsForUser(await listReceipts(80), user.id),
      isPartial(request),
      await resolvePlatformOwnerAccess(user.id)
    );
    return reply.type("text/html").send(html);
  });

  app.get("/perfil", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    const full = await getUserById(user.id);
    if (!full) return reply.redirect("/login");
    const stats = await dashboardStats(user.id);
    const ranking = await salesRankingByUser(50);
    const rankIdx = ranking.findIndex((r) => r.userId === user.id);
    const meta = await panelUserMeta(user.id);
    const notificationPrefs = await getNotificationPrefs(user.id);
    const html = profilePage(
      full,
      {
        salesTotalCents: stats.salesTotalCents,
        salesCount: stats.salesCount,
        rank: rankIdx >= 0 ? rankIdx + 1 : null
      },
      notificationPrefs,
      query.msg,
      query.t === "err",
      isPartial(request),
      meta.label,
      meta.showAdminNav
    );
    return reply.type("text/html").send(html);
  });

  app.post("/perfil", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const { fields, avatarUrl } = await parseProfileMultipart(request);
      const full = await getUserById(user.id);
      const patch: { name?: string; username?: string; avatarUrl?: string } = {};
      if (fields.name?.trim()) patch.name = fields.name.trim();
      if (fields.username?.trim()) patch.username = fields.username.trim();
      const avatarData = fields.avatarData?.trim() ?? "";
      const nextAvatar = avatarUrl || (avatarData.startsWith("data:") ? avatarData : "");
      if (nextAvatar) patch.avatarUrl = nextAvatar;
      if (Object.keys(patch).length === 0) {
        return reply.redirect(flashRedirect("/perfil", "Nada para salvar.", "err"));
      }
      await updateUserProfile(user.id, patch);
      const msg = nextAvatar ? "Perfil e foto atualizados!" : "Perfil atualizado!";
      return reply.redirect(flashRedirect("/perfil", msg));
    } catch (error) {
      return reply.redirect(flashRedirect("/perfil", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/perfil/senha", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const body = z
        .object({
          password: z.string().min(6),
          passwordConfirm: z.string().min(6)
        })
        .parse(request.body);
      if (body.password !== body.passwordConfirm) {
        return reply.redirect(flashRedirect("/perfil", "As senhas não coincidem.", "err"));
      }
      await updateUserProfile(user.id, { password: body.password });
      return reply.redirect(flashRedirect("/perfil", "Senha atualizada!"));
    } catch (error) {
      return reply.redirect(flashRedirect("/perfil", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/perfil/notificacoes", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const body = (request.body ?? {}) as Record<string, string | undefined>;
      const flag = (v: string | undefined) => v === "on" || v === "true" || v === "1";
      await saveNotificationPrefs(user.id, {
        enabled: flag(body.enabled),
        sales: flag(body.sales),
        leads: flag(body.leads),
        instances: flag(body.instances),
        dailySummary: flag(body.dailySummary),
        desktop: flag(body.desktop)
      });
      return reply.redirect(flashRedirect("/perfil", "Preferências de notificação salvas!"));
    } catch (error) {
      return reply.redirect(flashRedirect("/perfil", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.get("/products", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z.object({ msg: z.string().optional() }).parse(request.query);
    const bots = await loadBots(user.id);
    if (bots.length > 0) {
      await syncAllProductsFromBots(bots.map((b) => ({ id: b.id, prompt: b.prompt })));
      hooks.syncBots();
    }
    const showAdminNav = await resolvePlatformOwnerAccess(user.id);
    const html = productsPage(
      bots,
      await rowsForUser(await listProducts(), user.id),
      query.msg,
      isPartial(request),
      showAdminNav
    );
    return reply.type("text/html").send(html);
  });

  app.post("/products/sync", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const bots = await loadBots(user.id);
      const n = await syncAllProductsFromBots(bots.map((b) => ({ id: b.id, prompt: b.prompt })));
      hooks.syncBots();
      const msg =
        n > 0
          ? `${n} produto(s) sincronizado(s) do prompt!`
          : "Nenhum pacote com R$ encontrado no prompt. Confira a seção Pacotes.";
      return reply.redirect(flashRedirect("/products", msg, n > 0 ? undefined : "err"));
    } catch (error) {
      return reply.redirect(flashRedirect("/products", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/products", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const body = z
        .object({
          botId: z.string().min(1),
          name: z.string().min(1),
          price: z.coerce.number().min(1),
          allowHalfPrice: z.string().optional(),
          halfPricePercent: z.coerce.number().min(10).max(90).optional()
        })
        .parse(request.body);
      await saveProduct({
        botId: body.botId,
        name: body.name,
        priceCents: Math.round(body.price * 100),
        allowHalfPrice: body.allowHalfPrice === "true",
        halfPricePercent: body.halfPricePercent ?? 50
      });
      hooks.syncBots();
      return reply.redirect(flashRedirect("/products", "Produto salvo!"));
    } catch (error) {
      return reply.redirect(flashRedirect("/products", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.get("/media", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const html = mediaPage(
      await loadBots(user.id),
      isPartial(request),
      await resolvePlatformOwnerAccess(user.id)
    );
    return reply.type("text/html").send(html);
  });

  app.get("/links", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    const links = await listWaRedirectLinks(user.id);
    const bots = await loadBots(user.id);
    const waBots = bots
      .map((b) => ({ id: b.id, name: b.name, waPhoneNumber: b.waPhoneNumber?.trim() || "" }));
    const base = (env.PUBLIC_BASE_URL || `${request.protocol}://${request.hostname}`).replace(/\/$/, "");
    const flash = query.msg ? { message: query.msg, ok: query.t !== "err" } : undefined;
    const showAdminNav = await resolvePlatformOwnerAccess(user.id);
    return reply
      .type("text/html")
      .send(waLinksPage(links, base, isPartial(request), panelUserLabel(user), flash, waBots, showAdminNav));
  });

  app.post("/links", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const body = request.body as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const slug = String(body.slug ?? "").trim();
    const initialMessage = String(body.initialMessage ?? "").trim();
    const targets = parseFormTargets(body);
    try {
      await createWaRedirectLink({ userId: user.id, name, slug, initialMessage, targets });
      return reply.redirect(flashRedirect("/links", "Link criado!"));
    } catch (error) {
      return reply.redirect(flashRedirect("/links", errorMessage(error), "err"));
    }
  });

  app.post("/links/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = request.body as Record<string, unknown>;
    try {
      await updateWaRedirectLink(id, user.id, {
        name: String(body.name ?? "").trim(),
        slug: String(body.slug ?? "").trim(),
        initialMessage: String(body.initialMessage ?? "").trim(),
        targets: parseFormTargets(body)
      });
      return reply.redirect(flashRedirect("/links", "Link salvo!"));
    } catch (error) {
      return reply.redirect(flashRedirect("/links", errorMessage(error), "err"));
    }
  });

  app.post("/links/:id/delete", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    try {
      await deleteWaRedirectLink(id, user.id);
      return reply.redirect(flashRedirect("/links", "Link excluído."));
    } catch (error) {
      return reply.redirect(flashRedirect("/links", errorMessage(error), "err"));
    }
  });

  app.post("/links/:id/reset", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    try {
      await resetWaRedirectLinkCounts(id, user.id);
      return reply.redirect(flashRedirect("/links", "Contadores zerados!"));
    } catch (error) {
      return reply.redirect(flashRedirect("/links", errorMessage(error), "err"));
    }
  });

  app.get("/r/:slug", async (request, reply) => {
    const { slug } = z.object({ slug: z.string().min(1) }).parse(request.params);
    const link = await getWaRedirectLinkBySlug(slug);
    if (!link) {
      return reply.code(404).type("text/html").send(
        "<!doctype html><html lang='pt-BR'><body style='font-family:system-ui;padding:40px;background:#000000;color:#fff'><h1>Link não encontrado</h1></body></html>"
      );
    }
    const pick = pickTargetForRedirect(link);
    if (!pick) {
      return reply.code(503).type("text/html").send(
        "<!doctype html><html lang='pt-BR'><body style='font-family:system-ui;padding:40px;background:#000000;color:#fff'><h1>Indisponível</h1><p>Nenhum número configurado neste rodízio. Edite o link no painel.</p></body></html>"
      );
    }
    const phone = phoneForTargetInLink(link, pick.id);
    if (!phone) {
      return reply.code(503).type("text/html").send(
        "<!doctype html><html lang='pt-BR'><body style='font-family:system-ui;padding:40px;background:#000000;color:#fff'><h1>Indisponível</h1><p>Número inválido no rodízio.</p></body></html>"
      );
    }
    void recordRedirectClick(link.id, pick.id);
    const url = buildWaMeUrl(phone, link.initialMessage);
    return reply.redirect(url);
  });

  app.get("/wa/:userId", async (request, reply) => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(request.params);
    const query = z.object({ text: z.string().optional() }).parse(request.query);
    const bots = await loadBots(userId);
    const phonesMap = await getWaPhonesForBots(bots);
    const phones = Object.values(phonesMap).filter((p): p is string => Boolean(p?.trim()));
    const pick = pickDistributionPhone(userId, phones);
    if (!pick) {
      return reply
        .code(503)
        .type("text/html")
        .send(
          "<!doctype html><html lang='pt-BR'><body style='font-family:system-ui;padding:40px;background:#000000;color:#fff'><h1>Indisponível</h1><p>Nenhum WhatsApp conectado no momento. Tente novamente em instantes.</p></body></html>"
        );
    }
    const url = buildWaMeUrl(pick, query.text || "");
    return reply.redirect(url);
  });

  app.get("/instances", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    const bots = await loadBots(user.id);
    const statuses = await getWaLiveStatuses(bots);
    const showAdminNav = await resolvePlatformOwnerAccess(user.id);
    return reply
      .type("text/html")
      .send(
        instancesPage(bots, query.msg, query.t === "err", isPartial(request), panelUserLabel(user), statuses, showAdminNav)
      );
  });

  app.get("/instances/new", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    const showAdminNav = await resolvePlatformOwnerAccess(user.id);
    return reply
      .type("text/html")
      .send(newInstancePage(query.msg, query.t === "err", isPartial(request), panelUserLabel(user), showAdminNav));
  });

  app.get("/instances/:id/edit", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const bot = await getBotById(params.id, user.id);
    if (!bot) return reply.redirect(flashRedirect("/instances", "Instância não encontrada.", "err"));

    // Backfill: instâncias antigas ficaram sem biblioteca de áudios. Popula com os
    // áudios padrão (URLs estáveis /seed-audios/) para aparecerem e serem editáveis.
    if (!bot.audioLibrary || bot.audioLibrary.length === 0) {
      const seeded = await buildDefaultAudioLibrary();
      if (seeded.length > 0) {
        bot.audioLibrary = seeded;
        await upsertBot(bot);
        hooks.syncBots();
      }
    }

    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    const showAdminNav = await resolvePlatformOwnerAccess(user.id);
    return reply
      .type("text/html")
      .send(editInstancePage(bot, query.msg, query.t === "err", isPartial(request), panelUserLabel(user), showAdminNav));
  });

  app.post("/instances/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const editPath = `/instances/${params.id}/edit`;
    try {
      const existing = await getBotById(params.id, user.id);
      if (!existing) return reply.redirect(flashRedirect("/instances", "Instância não encontrada.", "err"));

      const {
        fields,
        fieldArrays,
        previewUploads,
        deliveryUploads,
        newNamedAudioUrl,
        priceTableUpload,
        callVideoUpload,
        callAvatarUpload,
        audioReplacements
      } = await parseBotMultipart(request);
      const body = botFormFieldsSchema.parse(fields);
      await ensureInstanceAIKey(user, body, existing);
      const laranjinhaKey = body.laranjinhaApiKey?.trim();
      const merged = applyTelegramFieldsFromForm(
        applyAIFieldsFromForm(
          applyWaFieldsFromForm(
            {
        ...existing,
        name: body.name,
              token: existing.token,
              platform: existing.platform || "whatsapp",
        prompt: body.prompt,
        pixKey: body.pixKey || existing.pixKey,
        pixRecipientName: body.pixRecipientName?.trim() || body.name,
        messageDelayMs: messageDelayMsFromForm(body),
        previewMediaUrls: mergePreviewUrls(existing.previewMediaUrls, fields, previewUploads),
              deliveryMediaUrls: mergeDeliveryUrls(existing.deliveryMediaUrls, fields, deliveryUploads),
              audioLibrary: mergeAudioLibrary(
                existing.audioLibrary ?? [],
                fields,
                newNamedAudioUrl,
                audioReplacements
              ),
        active: body.active === "true",
        paymentMethod: body.paymentMethod,
        laranjinhaApiKeyEncrypted: laranjinhaKey
          ? encryptSecret(laranjinhaKey)
          : existing.laranjinhaApiKeyEncrypted,
        productName: body.productName,
        productPriceCents: Math.round(body.productPrice * 100),
              deliveryLink: body.deliveryLink?.trim() || existing.deliveryLink || "",
              videoCallLink: body.videoCallLink?.trim() || existing.videoCallLink || "",
              videoCallVideoUrl: resolveCallVideoUrl(existing.videoCallVideoUrl, fields, callVideoUpload),
              videoCallCallerName: body.videoCallCallerName?.trim() || existing.videoCallCallerName || body.name,
              videoCallAvatarUrl: resolveCallAvatarUrl(existing.videoCallAvatarUrl, fields, callAvatarUpload),
              locale: body.locale === "en-US" ? "en-US" : "pt-BR",
              backupToken: body.backupToken?.trim() || existing.backupToken,
              followUpEnabled: body.followUpEnabled === "true",
              followUpAfterMinutes: body.followUpAfterMinutes,
              followUpMaxPerLead: body.followUpMaxPerLead,
              followUpSteps: followUpStepsFromForm(fieldArrays),
              priceTableImageUrl: resolvePriceTableImageUrl(existing.priceTableImageUrl, fields, priceTableUpload)
            },
            body
          ),
          body
        ),
        body
      );
      const updated = merged;
      await upsertBot(updated);
      await syncProductsFromPrompt(updated.id, updated.prompt);
      hooks.syncBots();
      if (botNeedsMotorRestart(existing, updated)) {
        hooks.restartBot(updated.id);
        const channel = updated.platform === "telegram" ? "Telegram" : "WhatsApp";
        return reply.redirect(flashRedirect("/instances", `Instância atualizada! Reiniciando conexão ${channel}...`));
      }
      const aiMsg = body.aiApiKey?.trim() ? " IA aplicada sem desconectar." : "";
      return reply.redirect(flashRedirect("/instances", `Instância salva!${aiMsg}`));
    } catch (error) {
      request.log.error(error);
      return reply.redirect(flashRedirect(editPath, `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.get("/settings", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    return reply.redirect("/instances");
  });

  app.get("/admin/usuarios", async (request, reply) => {
    const user = await requirePlatformOwner(request, reply);
    if (!user) return;
    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    const meta = await panelUserMeta(user.id);
    const users = await listPlatformUsers();
    return reply
      .type("text/html")
      .send(
        adminUsersPage(
          users,
          query.msg,
          query.t === "err",
          isPartial(request),
          meta.label,
          meta.avatarUrl
        )
      );
  });

  app.post("/admin/broadcast", async (request, reply) => {
    const user = await requirePlatformOwner(request, reply);
    if (!user) return;
    try {
      const body = z
        .object({
          title: z.string().min(2).max(80),
          body: z.string().min(2).max(240)
        })
        .parse(request.body ?? {});
      const { notifyAllUsersPush, isWebPushConfigured } = await import("../lib/web-push.js");
      if (!isWebPushConfigured()) {
        return reply.redirect(
          flashRedirect("/admin/usuarios", "Configure VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no Railway.", "err")
        );
      }
      const result = await notifyAllUsersPush({
        title: body.title.trim(),
        body: body.body.trim(),
        url: "/",
        tag: `admin-broadcast-${Date.now()}`
      });
      return reply.redirect(
        flashRedirect(
          "/admin/usuarios",
          `Aviso enviado: ${result.sent} dispositivo(s) · ${result.users} conta(s) com push.`
        )
      );
    } catch (error) {
      request.log.error(error);
      return reply.redirect(flashRedirect("/admin/usuarios", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/admin/usuarios/:id/delete", async (request, reply) => {
    const user = await requirePlatformOwner(request, reply);
    if (!user) return;
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const botIds = await deletePlatformUser(params.id, user);
      for (const botId of botIds) {
        await purgeWaInstanceData(botId);
        await pruneRedirectLinksForBot(params.id, botId);
        hooks.restartBot(botId);
      }
      hooks.syncBots();
      return reply.redirect(flashRedirect("/admin/usuarios", "Conta excluída com sucesso."));
    } catch (error) {
      return reply.redirect(flashRedirect("/admin/usuarios", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.get("/admin/aquecimento", async (request, reply) => reply.redirect("/admin/maturador"));
  app.get("/admin/maturador", async (request, reply) => {
    const user = await requirePlatformOwner(request, reply);
    if (!user) return;
    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    const meta = await panelUserMeta(user.id);
    const users = await listPlatformUsers();
    const warmingMap = await countWarmingChipsByUser();
    const sessions = await listActiveWarmSessions();
    const rows = users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username || u.email.split("@")[0] || "user",
      warmingChips: warmingMap[u.id] ?? 0,
      activeSessions: sessions.filter((s) => s.userId === u.id).length
    }));
    return reply.type("text/html").send(
      adminWarmOverviewPage({
        users: rows,
        totalWarming: await countPlatformWarmingChips(),
        totalSessions: sessions.length,
        userName: meta.label,
        userAvatar: meta.avatarUrl,
        message: query.msg,
        isError: query.t === "err"
      })
    );
  });

  app.get("/aquecimento", async (_request, reply) => reply.redirect("/maturador"));
  app.get("/aquecimento/novo", async (_request, reply) => reply.redirect("/maturador/novo"));
  app.get("/aquecimento/sessao/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    return reply.redirect(`/maturador/sessao/${params.id}`);
  });

  app.get("/maturador", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    const meta = await panelUserMeta(user.id);
    const bots = await loadBots(user.id);
    const statuses = await getWaLiveStatuses(bots);
    const sessions = await listWarmSessions(user.id);
    const allBotIds = [...new Set(sessions.flatMap((s) => s.botIds))];
    const scores = await getBotWarmScores(user.id, allBotIds);
    const showAdminNav = await resolvePlatformOwnerAccess(user.id);
    return reply.type("text/html").send(
      chipWarmerDashboardPage({
        userName: meta.label,
        userAvatar: meta.avatarUrl,
        sessions,
        bots,
        statuses,
        scores,
          message: query.msg,
        isError: query.t === "err",
        partial: isPartial(request),
        showAdminNav
      })
    );
  });

  app.get("/maturador/novo", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    const meta = await panelUserMeta(user.id);
    const bots = await loadBots(user.id);
    const statuses = await getWaLiveStatuses(bots);
    const scores = await getBotWarmScores(
      user.id,
      bots.map((b) => b.id)
    );
    const showAdminNav = await resolvePlatformOwnerAccess(user.id);
    return reply.type("text/html").send(
      chipWarmerNewPage({
        userName: meta.label,
        userAvatar: meta.avatarUrl,
        bots,
        statuses,
        scores,
        message: query.msg,
        isError: query.t === "err",
        partial: isPartial(request),
        showAdminNav
      })
    );
  });

  app.get("/maturador/sessao/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    const session = await getWarmSession(params.id, user.id);
    if (!session) return reply.redirect(flashRedirect("/maturador", "Sessão não encontrada.", "err"));
    const meta = await panelUserMeta(user.id);
    const bots = await loadBots(user.id);
    const scores = await getBotWarmScores(user.id, session.botIds);
    const showAdminNav = await resolvePlatformOwnerAccess(user.id);
    return reply.type("text/html").send(
      chipWarmerSessionPage({
        userName: meta.label,
        userAvatar: meta.avatarUrl,
        session,
        bots,
        scores,
        message: query.msg,
        isError: query.t === "err",
        partial: isPartial(request),
        showAdminNav
      })
    );
  });

  app.post("/maturador/sessao/criar", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const body = z
        .object({
          name: z.string().optional(),
          mode: z.enum(["groups", "p2p"]).default("groups"),
          botIds: z.union([z.string(), z.array(z.string())]),
          groupIds: z.string().optional(),
          groupsMeta: z.string().optional(),
          totalDays: z.coerce.number().optional(),
          activeHourStart: z.coerce.number().optional(),
          activeHourEnd: z.coerce.number().optional()
        })
        .parse(request.body ?? {});
      const botIds = Array.isArray(body.botIds) ? body.botIds : [body.botIds];
      const groupIds = (body.groupIds || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      let groupsMeta: { id: string; name: string }[] = [];
      try {
        groupsMeta = JSON.parse(body.groupsMeta || "[]");
      } catch {
        groupsMeta = [];
      }
      const session = await createWarmSession({
        userId: user.id,
        name: body.name || "",
        mode: body.mode,
        botIds,
        groupIds,
        groupsMeta,
        totalDays: body.totalDays,
        activeHourStart: body.activeHourStart,
        activeHourEnd: body.activeHourEnd
      });
      hooks.syncBots();
      return reply.redirect(
        flashRedirect(`/maturador/sessao/${session.id}`, "Maturador ativado! IA pausada — ative manualmente ao encerrar.")
      );
    } catch (error) {
      return reply.redirect(flashRedirect("/maturador/novo", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/aquecimento/sessao/criar", async (_request, reply) => reply.redirect("/maturador/novo"));

  app.post("/maturador/sessao/:id/pausar", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      await setWarmSessionStatus(params.id, user.id, "paused");
      return reply.redirect(flashRedirect(`/maturador/sessao/${params.id}`, "Sessão pausada."));
    } catch (error) {
      return reply.redirect(flashRedirect("/maturador", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/maturador/sessao/:id/retomar", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      await setWarmSessionStatus(params.id, user.id, "active");
      return reply.redirect(flashRedirect(`/maturador/sessao/${params.id}`, "Sessão retomada."));
    } catch (error) {
      return reply.redirect(flashRedirect("/maturador", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/maturador/sessao/:id/encerrar", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      await setWarmSessionStatus(params.id, user.id, "completed");
      hooks.syncBots();
      return reply.redirect(flashRedirect("/maturador", "Maturação encerrada. Ative a IA na instância para vender."));
    } catch (error) {
      return reply.redirect(flashRedirect("/maturador", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/api/chip-warmer/discover-groups", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const body = z.object({ botIds: z.array(z.string().min(1)).min(2) }).parse(request.body ?? {});
      const bots = await loadBots(user.id);
      for (const id of body.botIds) {
        if (!bots.some((b) => b.id === id)) throw new Error("Instância inválida.");
      }
      const common = await discoverCommonGroupsForBots(user.id, body.botIds);
      return reply.send({ ok: true, common, perBot: body.botIds.length });
    } catch (error) {
      return reply.code(400).send({ ok: false, error: errorMessage(error) });
    }
  });

  app.post("/settings/previews", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    let botId = "";
    try {
      const { fields, previewUploads } = await parseBotMultipart(request);
      botId = fields.botId?.trim() || "";
      if (!botId) throw new Error("Selecione uma instância.");
      const bot = await getBotById(botId, user.id);
      if (!bot) throw new Error("Instância não encontrada.");
      await upsertBot({
        ...bot,
        previewMediaUrls: mergePreviewUrls(bot.previewMediaUrls ?? [], fields, previewUploads)
      });
      hooks.syncBots();
      return reply.redirect(
        flashRedirect(`/instances/${botId}/edit`, "Prévias da instância atualizadas!")
      );
    } catch (error) {
      request.log.error(error);
      const dest = botId ? `/instances/${botId}/edit` : "/instances";
      return reply.redirect(flashRedirect(dest, `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/settings", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    return reply.redirect("/instances");
  });

  app.post("/api/prompt-generator", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const body = z
        .object({
          personaName: z.string().min(1),
          tone: z.string().default("carinhosa"),
          niche: z.string().default("conteúdo digital"),
          packages: z.string().min(1),
          extraRules: z.string().optional()
        })
        .parse(request.body ?? {});
      const prompt = await generateBotPrompt(user.id, body);
      return reply.send({ ok: true, prompt });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ ok: false, error: errorMessage(error) });
    }
  });

  app.get("/uploads/:file", async (request, reply) => {
    const params = z.object({ file: z.string().min(1) }).parse(request.params);
    const fileName = path.basename(params.file);
    const filePath = path.join(uploadsDir, fileName);
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat) {
      return reply.code(404).send("Arquivo nao encontrado.");
    }
    const mime = mimeTypeFromPath(filePath);
    const total = stat.size;
    reply.header("Accept-Ranges", "bytes");
    reply.header("Cache-Control", "public, max-age=3600");
    if (mime.startsWith("video/") || mime.startsWith("audio/")) {
      reply.header("Content-Disposition", "inline");
    }
    const rangeHeader = request.headers.range;
    if (rangeHeader && /^bytes=/i.test(rangeHeader)) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
      if (match) {
        let start = match[1] ? parseInt(match[1], 10) : 0;
        let end = match[2] ? parseInt(match[2], 10) : total - 1;
        if (Number.isNaN(start)) start = 0;
        if (Number.isNaN(end) || end >= total) end = total - 1;
        if (start > end || start >= total) {
          reply.header("Content-Range", `bytes */${total}`);
          return reply.code(416).send();
        }
        reply.code(206);
        reply.header("Content-Range", `bytes ${start}-${end}/${total}`);
        reply.header("Content-Length", String(end - start + 1));
        return reply.type(mime).send(fsSync.createReadStream(filePath, { start, end }));
      }
    }
    reply.header("Content-Length", String(total));
    return reply.type(mime).send(fsSync.createReadStream(filePath));
  });

  // Vídeo da chamada salvo no banco (sobrevive a deploy). Suporta Range (206).
  app.get("/call-video/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(8) }).parse(request.params);
    const video = await getCallVideo(params.id);
    if (!video) return reply.code(404).send("Video nao encontrado.");
    const total = video.bytes.length;
    reply.header("Accept-Ranges", "bytes");
    reply.header("Cache-Control", "public, max-age=86400");
    reply.header("Content-Disposition", "inline");
    const rangeHeader = request.headers.range;
    if (rangeHeader && /^bytes=/i.test(rangeHeader)) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
      if (match) {
        let start = match[1] ? parseInt(match[1], 10) : 0;
        let end = match[2] ? parseInt(match[2], 10) : total - 1;
        if (Number.isNaN(start)) start = 0;
        if (Number.isNaN(end) || end >= total) end = total - 1;
        if (start > end || start >= total) {
          reply.header("Content-Range", `bytes */${total}`);
          return reply.code(416).send();
        }
        const slice = video.bytes.subarray(start, end + 1);
        reply.code(206);
        reply.header("Content-Range", `bytes ${start}-${end}/${total}`);
        reply.header("Content-Length", String(slice.length));
        return reply.type(video.mime).send(slice);
      }
    }
    reply.header("Content-Length", String(total));
    return reply.type(video.mime).send(video.bytes);
  });

  app.get("/seed-audios/:file", async (request, reply) => {
    const params = z.object({ file: z.string().min(1) }).parse(request.params);
    const filePath = seedAudioPath(params.file);
    if (!filePath) return reply.code(404).send("Audio nao encontrado.");
    return reply.type(mimeTypeFromPath(filePath)).send(fsSync.createReadStream(filePath));
  });

  app.post("/bots", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const {
        fields,
        fieldArrays,
        previewUploads,
        deliveryUploads,
        newNamedAudioUrl,
        priceTableUpload,
        callVideoUpload,
        callAvatarUpload,
        seedAudioReplacements
      } = await parseBotMultipart(request);
      const body = botFormFieldsSchema.parse(fields);
      await ensureInstanceAIKey(user, body);
      const botId = randomUUID();
      const platform = body.platform === "telegram" ? "telegram" : "whatsapp";
      const { DEFAULT_PROMPT_WHATSAPP, DEFAULT_PROMPT_WHATSAPP_EN } = await import("../lib/prompt-default.js");
      const defaultPrompt = body.locale === "en-US" ? DEFAULT_PROMPT_WHATSAPP_EN : DEFAULT_PROMPT_WHATSAPP;
      const promptText = body.prompt?.trim() || defaultPrompt;

      // Áudios padrão prontos para teste + o que o cliente já tenha subido no form
      const seededAudios = await buildDefaultAudioLibrary();
      const withSeedReplacements = await applySeedAudioReplacements(seededAudios, seedAudioReplacements);
      const initialAudioLibrary = mergeAudioLibrary(withSeedReplacements, fields, newNamedAudioUrl);

      await upsertBot(
        applyTelegramFieldsFromForm(
          applyAIFieldsFromForm(
            applyWaFieldsFromForm(
              {
                id: botId,
        userId: user.id,
        name: body.name,
                token: platform === "telegram" ? `tg-${botId}` : `wa-${botId}`,
                platform,
                waPort: platform === "telegram" ? undefined : waPortForBot(botId),
                waApiProvider: "whatsapp_web",
                proxyEnabled: false,
                metaPhoneNumberId: "",
                metaVerifyToken: defaultMetaVerifyToken(),
                prompt: promptText,
        pixKey: body.pixKey || "nao-configurado",
        pixRecipientName: body.pixRecipientName?.trim() || body.name,
        messageDelayMs: messageDelayMsFromForm(body),
        previewMediaUrls: mergePreviewUrls([], fields, previewUploads),
                deliveryMediaUrls: mergeDeliveryUrls([], fields, deliveryUploads),
                audioLibrary: initialAudioLibrary,
                avatarUrl: "",
        active: body.active === "true",
        paymentMethod: body.paymentMethod,
        laranjinhaApiKeyEncrypted: body.laranjinhaApiKey?.trim()
          ? encryptSecret(body.laranjinhaApiKey.trim())
          : undefined,
        productName: body.productName,
        productPriceCents: Math.round(body.productPrice * 100),
                deliveryLink: body.deliveryLink?.trim() || "",
                videoCallLink: body.videoCallLink?.trim() || "",
                videoCallVideoUrl: callVideoUpload || "",
                videoCallCallerName: body.videoCallCallerName?.trim() || body.name,
                videoCallAvatarUrl: callAvatarUpload || body.videoCallAvatarUrl?.trim() || "",
                locale: body.locale === "en-US" ? "en-US" : "pt-BR",
                backupToken: body.backupToken?.trim() || undefined,
                followUpEnabled: body.followUpEnabled === "true",
                followUpAfterMinutes: body.followUpAfterMinutes,
                followUpMaxPerLead: body.followUpMaxPerLead,
                followUpSteps: followUpStepsFromForm(fieldArrays),
                priceTableImageUrl: priceTableUpload || ""
              },
              body
            ),
            body
          ),
          body
        )
      );

      await syncProductsFromPrompt(botId, body.prompt);
      hooks.syncBots();
      hooks.ensureBots();
      if (platform === "telegram") {
        return reply.redirect(
          flashRedirect(
            `/instances/${botId}/tg`,
            "Instância Telegram criada! Informe o código quando o app pedir."
          )
        );
      }
      return reply.redirect(
        flashRedirect(
          `/instances/${botId}/qr`,
          "Instância criada! Escaneie o QR Code para conectar."
        )
      );
    } catch (error) {
      request.log.error(error);
      return reply.redirect(flashRedirect("/instances/new", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/bots/:id/toggle", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const bot = await getBotById(params.id, user.id);
      if (!bot) return reply.redirect(flashRedirect("/", "Bot nao encontrado.", "err"));
      bot.active = !bot.active;
      await upsertBot(bot);
      if (bot.active) hooks.ensureBots();
      else hooks.restartBot(params.id);
      return reply.redirect(
        flashRedirect("/", bot.active ? "Bot ativado." : "Bot pausado — nao responde no WhatsApp.")
      );
    } catch (error) {
      return reply.redirect(flashRedirect("/", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/instances/:id/reset-wa-session", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const bot = await getBotById(id, user.id);
    if (!bot) return reply.redirect(flashRedirect("/instances", "Instância não encontrada.", "err"));
    await purgeWaInstanceData(bot.id);
    hooks.restartBot(bot.id);
    return reply.redirect(
      flashRedirect(`/instances/${bot.id}/qr`, "Sessão WhatsApp apagada. Escaneie o QR Code novamente.")
    );
  });

  app.post("/bots/:id/delete", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      await purgeWaInstanceData(params.id);
      await pruneRedirectLinksForBot(user.id, params.id);
      await deleteBot(params.id, user.id);
      hooks.restartBot(params.id);
      return reply.redirect(flashRedirect("/instances", "Instância removida com sessão WhatsApp apagada."));
    } catch (error) {
      return reply.redirect(flashRedirect("/instances", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/restart", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    hooks.restartBots();
    return reply.redirect(flashRedirect("/", "Bots reiniciando..."));
  });
}
