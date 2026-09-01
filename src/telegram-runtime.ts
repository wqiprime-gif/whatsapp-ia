import { spawn, type ChildProcess } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { loadBots, uploadsDir, type BotConfig, isTelegramBot } from "./bots.js";
import { listProducts } from "./db/events.js";
import { getUserById } from "./db/users.js";
import { env, rootDir } from "./config.js";
import { decryptSecret } from "./lib/crypto.js";
import { AI_PROVIDERS } from "./lib/ai-providers.js";
import { resolveBotAIConfig } from "./lib/settings.js";

const telegramDir = path.join(rootDir, "telegram");
const instancesDir = path.join(env.DATA_DIR, "tg-instances");

function instanceDataDir(botId: string) {
  return path.join(instancesDir, botId);
}

type TgProcess = {
  child: ChildProcess;
  port: number;
  botId: string;
};

const processes = new Map<string, TgProcess>();
const lastExitCodes = new Map<string, number | null>();

function stablePort(botId: string, index: number) {
  const hash = parseInt(botId.replace(/\D/g, "").slice(0, 8), 10) || index;
  return 5200 + (hash % 700) + index;
}

export function tgPortForBot(botId: string, index = 0) {
  return stablePort(botId, index);
}

async function restoreTgSessionFromDb(botId: string, instDir: string): Promise<boolean> {
  const sessionFile = path.join(instDir, "session.txt");
  try {
    if (fsSync.existsSync(sessionFile) && fsSync.readFileSync(sessionFile, "utf8").trim()) {
      return true;
    }
  } catch {
    // ignore
  }

  try {
    const { getTgSessionBackup } = await import("./db/tg-session.js");
    const backup = await getTgSessionBackup(botId);
    if (!backup?.session) return false;
    await fs.mkdir(instDir, { recursive: true });
    await fs.writeFile(sessionFile, backup.session, "utf8");
    const when = backup.backedUpAt.toISOString();
    console.log(`[tg] ♻️ Sessão restaurada do PostgreSQL (${when}) → ${sessionFile}`);
    return true;
  } catch (err) {
    console.warn(`[tg] Falha ao restaurar sessão do PostgreSQL (${botId}):`, err);
    return false;
  }
}

async function writeInstanceFiles(bot: BotConfig) {
  const instDir = instanceDataDir(bot.id);
  await fs.mkdir(instDir, { recursive: true });
  const products = await listProducts(bot.id);
  await fs.writeFile(
    path.join(instDir, "bot-config.json"),
    JSON.stringify(
      {
        previewMediaUrls: bot.previewMediaUrls ?? [],
        productPresentationEnabled: Boolean(bot.productPresentationEnabled),
        productPresentationMediaUrls: bot.productPresentationMediaUrls ?? [],
        deliveryMediaUrls: bot.deliveryMediaUrls ?? [],
        pixKey: bot.pixKey,
        pixRecipientName: bot.pixRecipientName || bot.name,
        productName: bot.productName,
        productPriceCents: bot.productPriceCents,
        productDeliveryLink: bot.deliveryLink || "",
        videoCallLink: bot.videoCallLink || "",
        videoCallVideoUrl: bot.videoCallVideoUrl || "",
        videoCallCallerName: bot.videoCallCallerName || bot.name,
        videoCallAvatarUrl: bot.videoCallAvatarUrl || "",
        locale: bot.locale || "pt-BR",
        paymentMethod: bot.paymentMethod,
        messageDelayMs: bot.messageDelayMs ?? 2500,
        followUpEnabled: bot.followUpEnabled !== false,
        followUpAfterMinutes: bot.followUpAfterMinutes ?? 10,
        followUpMaxPerLead: bot.followUpMaxPerLead ?? 2,
        followUpSteps: bot.followUpSteps ?? [],
        priceTableImageUrl: bot.priceTableImageUrl ?? "",
        audioLibrary: (bot.audioLibrary ?? []).map((a) => ({
          label: a.label,
          url: a.url,
          slug: a.slug ?? "",
          triggers: a.triggers ?? "",
          keywords: a.keywords ?? ""
        })),
        products: products.map((p) => ({
          name: p.name,
          priceCents: p.priceCents,
          allowHalfPrice: p.allowHalfPrice,
          halfPricePercent: p.halfPricePercent
        })),
        giftPrompt: bot.giftPrompt ?? "",
        giftItems: bot.giftItems ?? [],
        postSaleEnabled: Boolean(bot.postSaleEnabled),
        upsellEnabled: Boolean(bot.upsellEnabled),
        upsellDelayMinutes: bot.upsellDelayMinutes ?? 2,
        upsellInPostSale: bot.upsellInPostSale !== false,
        upsellPrompt: bot.upsellPrompt ?? "",
        upsellRules: bot.upsellRules ?? [],
        platform: "telegram",
        updatedAt: new Date().toISOString()
      },
      null,
      2
    ),
    "utf8"
  );
  await fs.writeFile(
    path.join(instDir, "prompt.json"),
    JSON.stringify({ prompt: bot.prompt }, null, 2),
    "utf8"
  );
}

async function stopTelegramBot(botId: string) {
  const proc = processes.get(botId);
  if (!proc) return;
  try {
    proc.child.kill("SIGTERM");
  } catch {
    // ignore
  }
  processes.delete(botId);
}

async function startTelegramBot(bot: BotConfig, index: number) {
  if (!isTelegramBot(bot) || !bot.active) return;
  if (processes.has(bot.id)) return;

  const apiId = Number(bot.tgApiId || 0);
  let apiHash = "";
  try {
    if (bot.tgApiHashEncrypted) apiHash = decryptSecret(bot.tgApiHashEncrypted);
  } catch {
    apiHash = "";
  }
  const phone = String(bot.tgPhone || "").trim();

  if (!apiId || !apiHash) {
    console.error(
      `[tg] ${bot.name}: falta api_id/api_hash (my.telegram.org). Salve na edição da instância.`
    );
    return;
  }

  let apiKey = "";
  let provider: import("./lib/ai-providers.js").AIProviderId = "openai";
  let model = env.OPENAI_MODEL;
  const owner = bot.userId ? await getUserById(bot.userId) : null;
  try {
    const ai = await resolveBotAIConfig(bot, owner?.email);
    apiKey = ai.apiKey;
    provider = ai.provider;
    model = ai.model;
    console.log(`[tg] IA ${bot.name}: ${ai.provider} · ${ai.model} · fonte=${ai.source}`);
  } catch (err) {
    console.error(`[tg] IA ${bot.name}: ${err instanceof Error ? err.message : err}`);
  }

  if (!apiKey) {
    console.error(
      `[tg] ${bot.name}: IA sem chave API — configure OpenAI/provedor no painel antes de atender.`
    );
  }

  await writeInstanceFiles(bot);
  const port = bot.waPort && bot.waPort >= 5200 ? bot.waPort : tgPortForBot(bot.id, index);
  const instDir = instanceDataDir(bot.id);
  await restoreTgSessionFromDb(bot.id, instDir);
  const providerCfg = AI_PROVIDERS[provider];

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    OPENAI_API_KEY: apiKey || "",
    AI_MODEL: model,
    AI_PROVIDER: provider,
    AI_BASE_URL: providerCfg.baseURL || "",
    PANEL_URL: `http://127.0.0.1:${env.PORT}`,
    INTERNAL_SECRET: env.INTERNAL_SECRET,
    BOT_ID: bot.id,
    PIX_KEY: bot.pixKey,
    PIX_RECIPIENT: bot.pixRecipientName || bot.name,
    TG_INSTANCE_DIR: instDir,
    TG_API_ID: String(apiId),
    TG_API_HASH: apiHash,
    TG_PHONE: phone,
    UPLOADS_DIR: uploadsDir
  };

  const child = spawn(
    process.execPath,
    [path.join(telegramDir, "tg-instance.js"), "--port", String(port), "--sessionId", bot.id, "--modelName", bot.name],
    {
      cwd: telegramDir,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  child.stdout?.on("data", (chunk) => {
    const line = String(chunk).trim();
    if (line) console.log(`[tg:${bot.name}:${port}] ${line}`);
  });
  child.stderr?.on("data", (chunk) => {
    const line = String(chunk).trim();
    if (line) console.error(`[tg:${bot.name}:${port}] ${line}`);
  });
  child.on("exit", (code) => {
    processes.delete(bot.id);
    lastExitCodes.set(bot.id, code ?? null);
    console.log(`[tg] ${bot.name} encerrou (code ${code ?? "?"})`);
  });

  processes.set(bot.id, { child, port, botId: bot.id });
  console.log(`[tg] ${bot.name} iniciado na porta ${port} (MTProto / conta real)`);
}

export async function ensureTelegramBotsRunning() {
  const bots = await loadBots();
  const active = bots.filter((b) => b.active && isTelegramBot(b));
  let i = 0;
  for (const bot of active) {
    if (!processes.has(bot.id)) {
      await startTelegramBot(bot, i);
    }
    i += 1;
  }
}

export async function restartTelegramBots() {
  const bots = await loadBots();
  for (const id of [...processes.keys()]) {
    await stopTelegramBot(id);
  }
  await new Promise((r) => setTimeout(r, 1200));
  let i = 0;
  for (const bot of bots.filter((b) => b.active && isTelegramBot(b))) {
    await startTelegramBot(bot, i);
    i += 1;
  }
}

export async function restartSingleTelegramBot(botId: string) {
  await stopTelegramBot(botId);
  await new Promise((r) => setTimeout(r, 800));
  const bots = await loadBots();
  const bot = bots.find((b) => b.id === botId);
  if (!bot || !bot.active || !isTelegramBot(bot)) return;
  const index = bots.filter((b) => isTelegramBot(b)).findIndex((b) => b.id === botId);
  await startTelegramBot(bot, Math.max(0, index));
}

export async function syncTelegramBotConfigs() {
  const bots = await loadBots();
  for (const bot of bots.filter(isTelegramBot)) {
    await writeInstanceFiles(bot);
  }
}

export async function shutdownTelegramBots() {
  for (const id of [...processes.keys()]) {
    await stopTelegramBot(id);
  }
}

export function getTelegramLiveStatus(botId: string): string {
  const proc = processes.get(botId);
  if (!proc) return "offline";
  const statusPath = path.join(instanceDataDir(botId), "status.json");
  try {
    if (fsSync.existsSync(statusPath)) {
      const raw = JSON.parse(fsSync.readFileSync(statusPath, "utf8")) as { state?: string };
      const st = String(raw.state || "");
      if (st === "ready" || st === "authenticated") return "online";
      if (st === "need_code" || st === "need_password") return st;
      if (st === "error") return "error";
      if (st) return st;
    }
  } catch {
    // ignore
  }
  return proc.child.exitCode == null ? "starting" : "offline";
}

export async function getTelegramStatusPayload(botId: string) {
  const proc = processes.get(botId);
  const statusPath = path.join(instanceDataDir(botId), "status.json");
  let file: Record<string, unknown> = {};
  try {
    if (fsSync.existsSync(statusPath)) {
      file = JSON.parse(fsSync.readFileSync(statusPath, "utf8")) as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  if (proc) {
    try {
      const res = await fetch(`http://127.0.0.1:${proc.port}/api/status`, {
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) return (await res.json()) as Record<string, unknown>;
    } catch {
      // fall through to file
    }
  }
  return {
    ok: true,
    state: file.state || (proc ? "starting" : "offline"),
    connected: file.state === "ready" || file.state === "authenticated",
    connectedAs: file.connectedAs,
    error: file.error,
    pendingCodeHint: file.pendingCodeHint,
    platform: "telegram",
    exitCode: lastExitCodes.get(botId) ?? null
  };
}

export async function submitTelegramCode(botId: string, code: string) {
  const proc = processes.get(botId);
  if (!proc) throw new Error("Motor Telegram offline — ative a instância e aguarde.");
  const res = await fetch(`http://127.0.0.1:${proc.port}/api/code`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
    signal: AbortSignal.timeout(15000)
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) throw new Error(data.error || `Falha ao enviar código (${res.status})`);
  return data;
}

export async function submitTelegramPassword(botId: string, password: string) {
  const proc = processes.get(botId);
  if (!proc) throw new Error("Motor Telegram offline — ative a instância e aguarde.");
  const res = await fetch(`http://127.0.0.1:${proc.port}/api/password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(15000)
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) throw new Error(data.error || `Falha ao enviar senha (${res.status})`);
  return data;
}

export async function sendTgMessage(input: {
  botId: string;
  chatId: number;
  message: string;
  postSale?: boolean;
}) {
  const proc = processes.get(input.botId);
  if (!proc) throw new Error("Instância Telegram não está rodando.");
  const url = `http://127.0.0.1:${proc.port}/api/send`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jid: `tg:${input.chatId}`,
      message: input.message,
      postSale: Boolean(input.postSale)
    })
  });
  if (!response.ok) {
    let detail = "";
    try {
      const json = (await response.json()) as { error?: string };
      detail = json.error ?? "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(detail || `Falha ao enviar TG (HTTP ${response.status})`);
  }
}

export async function logoutTelegramSession(botId: string) {
  const proc = processes.get(botId);
  if (proc) {
    try {
      await fetch(`http://127.0.0.1:${proc.port}/api/logout`, {
        method: "POST",
        signal: AbortSignal.timeout(10000)
      });
    } catch {
      // ignore
    }
  }
  await stopTelegramBot(botId);
  const sessionFile = path.join(instanceDataDir(botId), "session.txt");
  try {
    await fs.unlink(sessionFile);
        } catch {
          // ignore
        }
  try {
    const { clearTgSessionBackup } = await import("./db/tg-session.js");
    await clearTgSessionBackup(botId);
  } catch {
    // ignore
  }
}
