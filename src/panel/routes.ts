import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { env, rootDir } from "../config.js";
import { useDatabase } from "../db/index.js";
import {
  dashboardStats,
  getLatestSale,
  leadSourcesStats,
  getConversationMessages,
  listConversationThreads,
  listLeads,
  listProducts,
  listReceipts,
  listRecentActivity,
  listSales,
  salesByDay,
  messagesByDay,
  salesRankingByBot,
  saveProduct
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
import { applyWaFieldsFromForm, defaultMetaVerifyToken } from "../lib/wa-bot-fields.js";
import { parseMetaWebhookBody, verifyMetaWebhook } from "../lib/meta-cloud-api.js";
import { sendRemarketingMulti } from "../lib/remarketing.js";
import { authenticateUser, createUser } from "../db/users.js";
import { encryptSecret } from "../lib/crypto.js";
import {
  clearSessionCookie,
  isAuthenticated,
  requireUser,
  setSessionCookie
} from "../lib/session.js";
import { getApiKeyStatus, getAIProvider, getOpenAIModel, updateOpenAISettings } from "../lib/settings.js";
import {
  leadsPage,
  mediaPage,
  paymentsPage,
  productsPage,
  remarketingPage,
  salesChartSvgFromData
} from "./pages.js";
import { messagesChartSvgFromData } from "./charts.js";
import { conversationsPage } from "./conversations-page.js";
import { giftsPage, mergeGiftItems } from "./gifts-page.js";
import { waQrPage } from "./wa-qr-page.js";
import { chatIdFromWaJid, readWaQr, waPortForBot } from "../whatsapp-runtime.js";
import { logMessage, logReceipt, logSale, upsertLead } from "../db/events.js";
import {
  activityFeedHtml,
  dashboardPage,
  formatRelativeTime,
  instancesPage,
  loginPage,
  editInstancePage,
  newInstancePage,
  registerPage,
  settingsPage,
  topBotsRankingHtml
} from "./ui.js";
import { panelUserLabel } from "./layout.js";

async function rowsForUser<T extends Record<string, unknown>>(rows: T[], userId: string) {
  const ids = new Set((await loadBots(userId)).map((b) => b.id));
  return rows.filter((r) => ids.has(String(r.bot_id ?? r.botId ?? "")));
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
  const previewUploads: string[] = [];
  const deliveryUploads: string[] = [];
  let avatarUrl = "";
  let newNamedAudioUrl = "";

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
      if (part.fieldname === "avatarFile") avatarUrl = url;
      continue;
    }
    const key = part.fieldname;
    if (key === "removeAudioIndexes" || key === "removePreviewIndexes") {
      const prev = fields[key] ? `${fields[key]},` : "";
      fields[key] = `${prev}${String(part.value || "")}`;
    } else {
      fields[key] = String(part.value || "");
    }
  }

  return { fields, previewUploads, deliveryUploads, avatarUrl, newNamedAudioUrl };
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

const botFormFieldsSchema = z.object({
  name: z.string().min(1),
  token: z.string().optional(),
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
  telegramGroupLink: z.string().default(""),
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
  metaVerifyToken: z.string().optional()
});

function messageDelayMsFromForm(input: { messageDelayMinutes: number; messageDelaySeconds: number }) {
  const totalSeconds = input.messageDelayMinutes * 60 + input.messageDelaySeconds;
  return Math.max(1500, totalSeconds * 1000);
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
  hooks: { restartBots: () => void }
) {
  await app.register(cookie);

  app.addHook("onRequest", async (request, reply) => {
    const urlPath = request.url.split("?")[0];
    const publicPaths = ["/login", "/register", "/uploads", "/health", "/brand", "/internal", "/webhooks"];
    if (publicPaths.some((p) => urlPath === p || urlPath.startsWith(`${p}/`))) return;
    if (!isAuthenticated(request)) return reply.redirect("/login");
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
      if (!chatId) return reply.send({ ok: false, error: "chatId invalido" });

      if (body.type === "lead") {
        await upsertLead({
          botId: body.botId,
          chatId,
          displayName: body.displayName,
          source: body.source
        });
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
    return reply.type("text/html").send(loginPage());
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
    const partial = isPartial(request);
    const html = dashboardPage(
      bots,
      {
        stats: await dashboardStats(user.id),
        chart: await salesByDay(7, user.id),
        messagesChart: await messagesByDay(7, user.id),
        activities: await listRecentActivity(8, user.id),
        topBots: await salesRankingByBot(5, user.id),
        leadSources: await leadSourcesStats(user.id)
      },
      query.msg,
      query.t === "err",
      partial,
      panelUserLabel(user)
    );
    return reply.type("text/html").send(html);
  });

  app.get("/api/panel/live", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const bots = await loadBots(user.id);
    const stats = await dashboardStats(user.id);
    const chart = await salesByDay(7, user.id);
    const messagesChart = await messagesByDay(7, user.id);
    const activities = await listRecentActivity(8, user.id);
    const topBots = await salesRankingByBot(5, user.id);
    const latestSale = await getLatestSale(user.id);
    const recentSales = await listSales(8, user.id);

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

    return reply.send({
      stats: {
        leads: stats.leads,
        salesTotalCents: stats.salesTotalCents,
        salesCount: stats.salesCount,
        messagesToday: stats.messagesToday,
        activeBots: bots.filter((b) => b.active).length
      },
      activityHtml: activityFeedHtml(activities),
      topBotsHtml: topBotsRankingHtml(topBots),
      chartSvg: salesChartSvgFromData(chart, { tall: true }),
      messagesChartSvg: messagesChartSvgFromData(messagesChart),
      latestSale: latestSale
        ? { id: latestSale.id, subtitle: latestSale.subtitle }
        : null,
      latestSaleAt: latestSale?.at ?? null,
      bellSales
    });
  });

  app.get("/leads", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const html = leadsPage(await rowsForUser(await listLeads(200), user.id), isPartial(request));
    return reply.type("text/html").send(html);
  });

  app.get("/brand/whatsapp-logo.svg", async (_request, reply) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
      <circle cx="24" cy="24" r="24" fill="#25D366"/>
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
      hooks.restartBots();
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
      await upsertBot({ ...bot, giftPrompt, giftItems });
      hooks.restartBots();
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
    const { listLeadsByBots } = await import("../db/events.js");
    const { listScheduledCampaigns } = await import("../lib/scheduled-campaigns.js");
    const leads = selectedBotIds.length ? await listLeadsByBots(selectedBotIds) : [];
    const scheduled = await listScheduledCampaigns(user.id);
    const html = remarketingPage(
      bots,
      selectedBotIds,
      leads,
      scheduled,
      query.msg,
      query.t === "err",
      isPartial(request)
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
        const scheduledAtRaw = String(raw.scheduledAt || "").trim();
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
          scheduledAt: scheduledAt.toISOString()
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
        sequenceDelayMs: seqDelayMs
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

  app.get("/api/panel/conversations/threads", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const botIds = (await loadBots(user.id)).map((b) => b.id);
    const threads = await listConversationThreads(botIds, 120);
    return reply.send({ threads });
  });

  app.get("/api/panel/conversations/messages", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z
      .object({ botId: z.string().uuid(), chatId: z.coerce.number() })
      .parse(request.query);
    const allowed = new Set((await loadBots(user.id)).map((b) => b.id));
    if (!allowed.has(query.botId)) return reply.code(403).send({ error: "forbidden" });
    const messages = await getConversationMessages(query.botId, query.chatId, 300);
    return reply.send({ messages });
  });

  app.get("/panel/conversations.js", async (_request, reply) => {
    const filePath = path.join(rootDir, "public", "panel", "conversations.js");
    const body = await fs.readFile(filePath, "utf8");
    return reply.type("application/javascript").send(body);
  });

  app.get("/conversations", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    return reply.type("text/html").send(conversationsPage(isPartial(request)));
  });

  app.get("/payments", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const html = paymentsPage(await rowsForUser(await listReceipts(80), user.id), isPartial(request));
    return reply.type("text/html").send(html);
  });

  app.get("/products", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z.object({ msg: z.string().optional() }).parse(request.query);
    const bots = await loadBots(user.id);
    const html = productsPage(
      bots,
      await rowsForUser(await listProducts(), user.id),
      query.msg,
      isPartial(request)
    );
    return reply.type("text/html").send(html);
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

  app.get("/instances", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z.object({ msg: z.string().optional(), t: z.string().optional() }).parse(request.query);
    return reply
      .type("text/html")
      .send(instancesPage(await loadBots(user.id), query.msg, query.t === "err", isPartial(request), panelUserLabel(user)));
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

      const { fields, previewUploads, deliveryUploads, avatarUrl, newNamedAudioUrl } =
        await parseBotMultipart(request);
      const body = botFormFieldsSchema.parse(fields);
      const laranjinhaKey = body.laranjinhaApiKey?.trim();
      await upsertBot(
        applyWaFieldsFromForm(
          {
            ...existing,
            name: body.name,
            token: existing.token,
            prompt: body.prompt,
            pixKey: body.pixKey || existing.pixKey,
            pixRecipientName: body.pixRecipientName?.trim() || body.name,
            messageDelayMs: messageDelayMsFromForm(body),
            previewMediaUrls: mergePreviewUrls(existing.previewMediaUrls, fields, previewUploads),
            deliveryMediaUrls: existing.deliveryMediaUrls,
            audioLibrary: mergeAudioLibrary(existing.audioLibrary ?? [], fields, newNamedAudioUrl),
            avatarUrl: avatarUrl || existing.avatarUrl,
            active: body.active === "true",
            paymentMethod: body.paymentMethod,
            laranjinhaApiKeyEncrypted: laranjinhaKey
              ? encryptSecret(laranjinhaKey)
              : existing.laranjinhaApiKeyEncrypted,
            productName: body.productName,
            productPriceCents: Math.round(body.productPrice * 100),
            telegramGroupLink: "",
            backupToken: body.backupToken?.trim() || existing.backupToken
          },
          body
        )
      );

      hooks.restartBots();
      return reply.redirect(flashRedirect("/instances", "Instância atualizada! Reiniciando bot..."));
    } catch (error) {
      request.log.error(error);
      return reply.redirect(flashRedirect(editPath, `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.get("/settings", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const query = z
      .object({ msg: z.string().optional(), t: z.string().optional(), botId: z.string().optional() })
      .parse(request.query);
    const bots = await loadBots(user.id);
    const previewBotId = query.botId || bots[0]?.id || "";
    const status = await getApiKeyStatus(user.id);
    const model = await getOpenAIModel(user.id);
    const provider = await getAIProvider(user.id);
    return reply.type("text/html").send(
      settingsPage(
        {
          message: query.msg,
          messageIsError: query.t === "err",
          maskedKey: status.masked,
          configured: status.configured,
          source: status.source,
          model,
          provider,
          providerLabel: status.providerLabel
        },
        bots,
        previewBotId,
        isPartial(request),
        panelUserLabel(user)
      )
    );
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
      hooks.restartBots();
      return reply.redirect(
        flashRedirect(`/settings?botId=${botId}`, "Prévias da instância atualizadas!")
      );
    } catch (error) {
      request.log.error(error);
      return reply.redirect(
        flashRedirect(`/settings?botId=${botId}`, `Erro: ${errorMessage(error)}`, "err")
      );
    }
  });

  app.post("/settings", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const body = z
        .object({
          openaiApiKey: z.string().optional(),
          openaiModel: z.string().optional(),
          aiProvider: z.string().optional()
        })
        .parse(request.body ?? {});
      await updateOpenAISettings(user.id, {
        apiKey: body.openaiApiKey,
        model: body.openaiModel,
        provider: body.aiProvider
      });
      return reply.redirect(flashRedirect("/settings", "Configurações salvas!"));
    } catch (error) {
      return reply.redirect(flashRedirect("/settings", `Erro: ${errorMessage(error)}`, "err"));
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
      const { fields, previewUploads, deliveryUploads, avatarUrl, newNamedAudioUrl } =
        await parseBotMultipart(request);
      const body = botFormFieldsSchema.parse(fields);
      const botId = randomUUID();

      await upsertBot(
        applyWaFieldsFromForm(
          {
            id: botId,
            userId: user.id,
            name: body.name,
            token: `wa-${botId}`,
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
            deliveryMediaUrls: [],
            audioLibrary: mergeAudioLibrary([], fields, newNamedAudioUrl),
            avatarUrl,
            active: body.active === "true",
            paymentMethod: body.paymentMethod,
            laranjinhaApiKeyEncrypted: body.laranjinhaApiKey?.trim()
              ? encryptSecret(body.laranjinhaApiKey.trim())
              : undefined,
            productName: body.productName,
            productPriceCents: Math.round(body.productPrice * 100),
            telegramGroupLink: "",
            backupToken: body.backupToken?.trim() || undefined
          },
          body
        )
      );

      hooks.restartBots();
      return reply.redirect(flashRedirect("/instances", "Instância salva! Ativando..."));
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
      hooks.restartBots();
      return reply.redirect(
        flashRedirect("/", bot.active ? "Bot ativado." : "Bot pausado — nao responde no WhatsApp.")
      );
    } catch (error) {
      return reply.redirect(flashRedirect("/", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/bots/:id/delete", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      await deleteBot(params.id, user.id);
      hooks.restartBots();
      return reply.redirect(flashRedirect("/", "Bot removido."));
    } catch (error) {
      return reply.redirect(flashRedirect("/", `Erro: ${errorMessage(error)}`, "err"));
    }
  });

  app.post("/restart", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    hooks.restartBots();
    return reply.redirect(flashRedirect("/", "Bots reiniciando..."));
  });
}
