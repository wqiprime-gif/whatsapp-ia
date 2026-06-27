import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { onlyChatIconSvg, brandFaviconDataUri } from "./brand-icon.js";
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
import { buildDefaultAudioLibrary } from "../lib/seed-audios.js";
import { type BotPlatform } from "../lib/platform-types.js";
import { parseMetaWebhookBody, verifyMetaWebhook } from "../lib/meta-cloud-api.js";
import { sendRemarketingMulti } from "../lib/remarketing.js";
import { authenticateUser, createUser, getUserById, updateUserProfile } from "../db/users.js";
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
import { waQrPage } from "./wa-qr-page.js";
import { botNeedsMotorRestart, chatIdFromWaJid, getWaLiveStatuses, getWaPhonesForBots, pickDistributionPhone, purgeWaInstanceData, readWaQr, waPortForBot } from "../whatsapp-runtime.js";
import { buildWaMeUrl } from "../lib/wa-links.js";
import { PWA_MANIFEST, SERVICE_WORKER_JS } from "./pwa.js";
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

async function panelUserMeta(userId: string, fallbackEmail: string) {
  const full = await getUserById(userId);
  return {
    label: panelUserLabel({ name: full?.name ?? "", email: full?.email ?? fallbackEmail }),
    avatarUrl: full?.avatarUrl ?? ""
  };
}

const AVATAR_MAX_DATA_BYTES = 600_000;

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

async function parseBotMultipart(request: FastifyRequest) {
  const fields: Record<string, string> = {};
  const fieldArrays: Record<string, string[]> = {};
  const previewUploads: string[] = [];
  const deliveryUploads: string[] = [];
  let newNamedAudioUrl = "";
  let priceTableUpload = "";

  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (!part.filename) continue;
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

  return { fields, fieldArrays, previewUploads, deliveryUploads, newNamedAudioUrl, priceTableUpload };
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

function mergeAudioLibrary(
  existing: NamedAudio[],
  fields: Record<string, string>,
  newUrl: string
): NamedAudio[] {
  let library = [...existing];
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

  app.addHook("onRequest", async (request, reply) => {
    const urlPath = request.url.split("?")[0];
    const publicPaths = ["/login", "/register", "/uploads", "/health", "/brand", "/internal", "/webhooks"];
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
            "/login?msg=Sua+sessao+expirou.+Entre+novamente+com+seu+e-mail+e+senha."
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
        await upsertLead({
          botId: body.botId,
          chatId,
          displayName: body.displayName,
          source: body.source
        });
        request.log.info({ botId: body.botId, chatId, displayName: body.displayName }, "lead registrado");
      } else if (body.type === "message" && body.content) {
        await logMessage({
          botId: body.botId,
          chatId,
          role: (body.role as "user" | "assistant" | "system") ?? "user",
          content: body.content
        });
      } else if (body.type === "sale") {
        await logSale({
          botId: body.botId,
          chatId,
          productName: body.productName ?? "VIP",
          amountCents: body.amountCents ?? 0,
          paymentMethod: (body.paymentMethod as "pix" | "laranjinha") ?? "pix"
        });
        const saleBot = await getBotByIdAny(body.botId);
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
      }
      return reply.send({ ok: true });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ ok: false });
    }
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
        email: z.string().email(),
        password: z.string().min(1)
      })
      .parse(request.body);
    const user = await authenticateUser(body.email, body.password);
    if (!user) {
      return reply.code(401).type("text/html").send(loginPage("E-mail ou senha incorretos."));
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
    const meta = await panelUserMeta(user.id, user.email);
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
      full?.name ?? ""
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
    const label = panelUserLabel({ name: full?.name ?? "", email: full?.email ?? user.email });
    const notificationPrefs = await getNotificationPrefs(user.id);
    return reply.send({
      name: full?.name ?? "",
      email: full?.email ?? user.email,
      label,
      avatarUrl: full?.avatarUrl ?? "",
      notificationPrefs
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

    const activityTitles: Record<string, string> = {
      sale: "Venda aprovada",
      lead: "Nova conversa",
      receipt: "Pagamento confirmado"
    };

    const bellItems = activities.map((a) => ({
      id: a.id,
      kind: a.type,
      title: activityTitles[a.type] ?? a.title,
      subtitle: a.subtitle,
      time: formatRelativeTime(a.at),
      at: a.at
    }));

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
      sparkMessagesHtml: sparklineSvg(chartDayValues(messagesChart, (p) => p.count), "#00b4ff"),
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
    const html = leadsPage(await rowsForUser(await listLeads(200), user.id), isPartial(request));
    return reply.type("text/html").send(html);
  });

  app.get("/manifest.webmanifest", async (_request, reply) => {
    return reply.type("application/manifest+json").send(PWA_MANIFEST);
  });

  app.get("/sw.js", async (_request, reply) => {
    return reply
      .header("Service-Worker-Allowed", "/")
      .type("application/javascript; charset=utf-8")
      .send(SERVICE_WORKER_JS);
  });

  app.get("/favicon.ico", async (_request, reply) => {
    const png = path.join(rootDir, "public", "brand", "onlychat.png");
    if (fsSync.existsSync(png)) {
      return reply.type("image/png").send(fsSync.createReadStream(png));
    }
    return reply.redirect(brandFaviconDataUri());
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
    return reply.type("image/svg+xml").send(onlyChatIconSvg(120, "", "file"));
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
    return reply.type("image/svg+xml").send(onlyChatIconSvg(120, "", "png"));
  });

  app.get("/brand/whatsapp-logo.svg", async (_request, reply) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
      <circle cx="24" cy="24" r="24" fill="#0a5cff"/>
      <path fill="#fff" d="M34.2 13.5c-2.6-2.6-6.1-4-9.8-4-7.6 0-13.8 6.2-13.8 13.8 0 2.4.6 4.8 1.8 6.9L9 37l7.1-1.9c2 .9 4.2 1.4 6.4 1.4h.1c7.6 0 13.8-6.2 13.8-13.8 0-3.7-1.4-7.2-4-9.8l-.2-.4zm-9.8 21.3h-.1c-2 0-4-.5-5.7-1.5l-.4-.2-4.2 1.1 1.1-4.1-.3-.4c-1.1-1.7-1.7-3.7-1.7-5.8 0-6 4.9-10.9 10.9-10.9 2.9 0 5.7 1.1 7.8 3.2 2.1 2.1 3.2 4.9 3.2 7.8 0 6-4.9 10.9-10.9 10.9zm6-8.1c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.7.2-.2.3-.8 1.1-1 1.3-.2.2-.4.3-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.1.1-.3.2-.5.1-.2 0-.3 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.6-.5-.7-.5h-.6c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.6-.3z"/>
    </svg>`;
    return reply.type("image/svg+xml").send(svg);
  });

  app.get("/instances/:id/qr", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const bot = await getBotById(params.id, user.id);
    if (!bot) return reply.redirect(flashRedirect("/instances", "Instância não encontrada.", "err"));
    return reply.type("text/html").send(waQrPage(bot, isPartial(request), panelUserLabel(user)));
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

  app.get("/audios", async (_request, reply) => {
    return reply.redirect("/instances");
  });

  app.post("/audios", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    let botId = "";
    try {
      const { fields, newNamedAudioUrl } = await parseBotMultipart(request);
      botId = fields.botId?.trim() || "";
      if (!botId) throw new Error("Instância não informada.");
      const bot = await getBotById(botId, user.id);
      if (!bot) throw new Error("Instância não encontrada.");

      const library = mergeAudioLibrary(bot.audioLibrary ?? [], fields, newNamedAudioUrl);
      await upsertBot({ ...bot, audioLibrary: library });
      hooks.syncBots();
      return reply.redirect(
        flashRedirect(`/audios?botId=${botId}`, "Biblioteca de áudios atualizada!")
      );
    } catch (error) {
      request.log.error(error);
      return reply.redirect(
        flashRedirect(`/audios?botId=${botId}`, `Erro: ${errorMessage(error)}`, "err")
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
    const html = giftsPage(bots, botId, query.msg, query.t === "err", isPartial(request));
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
      await upsertBot({
        ...bot,
        giftPrompt,
        giftItems,
        postSaleEnabled: raw.postSaleEnabled === "on" || raw.postSaleEnabled === "true",
        postSaleWaitDays: Math.min(7, Math.max(1, Number(raw.postSaleWaitDays) || 2)),
        postSaleOpenerPrompt: String(raw.postSaleOpenerPrompt || "").trim(),
        postSaleWarmupReplies: Math.min(5, Math.max(1, Number(raw.postSaleWarmupReplies) || 2)),
        postSaleGiftDelayMinutes: Math.min(240, Math.max(5, Number(raw.postSaleGiftDelayMinutes) || 45))
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
      leadCountNoPurchase
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
    const html = paymentsPage(await rowsForUser(await listReceipts(80), user.id), isPartial(request));
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
    const meta = await panelUserMeta(user.id, user.email);
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
      meta.label
    );
    return reply.type("text/html").send(html);
  });

  app.post("/perfil", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const { fields, avatarUrl } = await parseProfileMultipart(request);
      const full = await getUserById(user.id);
      const patch: { name?: string; avatarUrl?: string } = {};
      if (fields.name?.trim()) patch.name = fields.name.trim();
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
    const html = productsPage(
      bots,
      await rowsForUser(await listProducts(), user.id),
      query.msg,
      isPartial(request)
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
    const html = mediaPage(await loadBots(user.id), isPartial(request));
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
    return reply
      .type("text/html")
      .send(waLinksPage(links, base, isPartial(request), panelUserLabel(user), flash, waBots));
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
        "<!doctype html><html lang='pt-BR'><body style='font-family:system-ui;padding:40px;background:#050505;color:#fff'><h1>Link não encontrado</h1></body></html>"
      );
    }
    const pick = pickTargetForRedirect(link);
    if (!pick) {
      return reply.code(503).type("text/html").send(
        "<!doctype html><html lang='pt-BR'><body style='font-family:system-ui;padding:40px;background:#050505;color:#fff'><h1>Indisponível</h1><p>Nenhum número configurado neste rodízio. Edite o link no painel.</p></body></html>"
      );
    }
    const phone = phoneForTargetInLink(link, pick.id);
    if (!phone) {
      return reply.code(503).type("text/html").send(
        "<!doctype html><html lang='pt-BR'><body style='font-family:system-ui;padding:40px;background:#050505;color:#fff'><h1>Indisponível</h1><p>Número inválido no rodízio.</p></body></html>"
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
          "<!doctype html><html lang='pt-BR'><body style='font-family:system-ui;padding:40px;background:#050505;color:#fff'><h1>Indisponível</h1><p>Nenhum WhatsApp conectado no momento. Tente novamente em instantes.</p></body></html>"
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
    return reply
      .type("text/html")
      .send(
        instancesPage(bots, query.msg, query.t === "err", isPartial(request), panelUserLabel(user), statuses)
      );
  });

  app.get("/instances/new", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    return reply
      .type("text/html")
      .send(newInstancePage(query.msg, query.t === "err", isPartial(request), panelUserLabel(user)));
  });

  app.get("/instances/:id/edit", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const bot = await getBotById(params.id, user.id);
    if (!bot) return reply.redirect(flashRedirect("/instances", "Instância não encontrada.", "err"));
    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    return reply
      .type("text/html")
      .send(editInstancePage(bot, query.msg, query.t === "err", isPartial(request), panelUserLabel(user)));
  });

  app.post("/instances/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const editPath = `/instances/${params.id}/edit`;
    try {
      const existing = await getBotById(params.id, user.id);
      if (!existing) return reply.redirect(flashRedirect("/instances", "Instância não encontrada.", "err"));

      const { fields, fieldArrays, previewUploads, deliveryUploads, newNamedAudioUrl, priceTableUpload } =
        await parseBotMultipart(request);
      const body = botFormFieldsSchema.parse(fields);
      await ensureInstanceAIKey(user, body, existing);
      const laranjinhaKey = body.laranjinhaApiKey?.trim();
      const merged = applyAIFieldsFromForm(
        applyWaFieldsFromForm(
          {
          ...existing,
          name: body.name,
          token: existing.token,
          platform: "whatsapp",
          prompt: body.prompt,
          pixKey: body.pixKey || existing.pixKey,
          pixRecipientName: body.pixRecipientName?.trim() || body.name,
          messageDelayMs: messageDelayMsFromForm(body),
          previewMediaUrls: mergePreviewUrls(existing.previewMediaUrls, fields, previewUploads),
          deliveryMediaUrls: mergeDeliveryUrls(existing.deliveryMediaUrls, fields, deliveryUploads),
          audioLibrary: mergeAudioLibrary(existing.audioLibrary ?? [], fields, newNamedAudioUrl),
          active: body.active === "true",
          paymentMethod: body.paymentMethod,
          laranjinhaApiKeyEncrypted: laranjinhaKey
            ? encryptSecret(laranjinhaKey)
            : existing.laranjinhaApiKeyEncrypted,
          productName: body.productName,
          productPriceCents: Math.round(body.productPrice * 100),
          deliveryLink: body.deliveryLink?.trim() || existing.deliveryLink || "",
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
      );
      const updated = merged;
      await upsertBot(updated);
      await syncProductsFromPrompt(updated.id, updated.prompt);
      hooks.syncBots();
      if (botNeedsMotorRestart(existing, updated)) {
        hooks.restartBot(updated.id);
        return reply.redirect(flashRedirect("/instances", "Instância atualizada! Reiniciando conexão WhatsApp..."));
      }
      const aiMsg = body.aiApiKey?.trim() ? " IA aplicada sem desconectar o WhatsApp." : "";
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
    try {
      await fs.access(filePath);
    } catch {
      return reply.code(404).send("Arquivo nao encontrado.");
    }
    return reply.type(mimeTypeFromPath(filePath)).send(fsSync.createReadStream(filePath));
  });

  app.post("/bots", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const { fields, fieldArrays, previewUploads, deliveryUploads, newNamedAudioUrl, priceTableUpload } =
        await parseBotMultipart(request);
      const body = botFormFieldsSchema.parse(fields);
      await ensureInstanceAIKey(user, body);
      const botId = randomUUID();
      const platform: BotPlatform = "whatsapp";

      // Áudios padrão prontos para teste + o que o cliente já tenha subido no form
      const seededAudios = await buildDefaultAudioLibrary();
      const initialAudioLibrary = mergeAudioLibrary(seededAudios, fields, newNamedAudioUrl);

      await upsertBot(
        applyAIFieldsFromForm(
          applyWaFieldsFromForm(
            {
              id: botId,
              userId: user.id,
              name: body.name,
              token: `wa-${botId}`,
              platform,
              waPort: waPortForBot(botId),
              waApiProvider: "whatsapp_web",
              proxyEnabled: false,
              metaPhoneNumberId: "",
              metaVerifyToken: defaultMetaVerifyToken(),
              prompt: body.prompt,
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
        )
      );

      await syncProductsFromPrompt(botId, body.prompt);
      hooks.syncBots();
      hooks.ensureBots();
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
