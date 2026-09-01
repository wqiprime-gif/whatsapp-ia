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
const lastStartErrors = new Map<string, string>();
const lastChildStderr = new Map<string, string>();

function writeTelegramBootStatus(botId: string, state: string, error?: string) {
  const statusPath = path.join(instanceDataDir(botId), "status.json");
  try {
    fsSync.mkdirSync(instanceDataDir(botId), { recursive: true });
    fsSync.writeFileSync(
      statusPath,
      JSON.stringify(
        {
          state,
          at: new Date().toISOString(),
          error: error || undefined
        },
        null,
        2
      ),
      "utf8"
    );
  } catch {
    // ignore
  }
}

function hasTgSessionOnDisk(botId: string) {
  const sessionFile = path.join(instanceDataDir(botId), "session.txt");
  try {
    return fsSync.existsSync(sessionFile) && Boolean(fsSync.readFileSync(sessionFile, "utf8").trim());
  } catch {
    return false;
  }
}

export function tgBotNeedsMotorRestart(before: BotConfig, after: BotConfig): boolean {
  if (!isTelegramBot(after)) return false;
  return (
    before.active !== after.active ||
    before.platform !== after.platform ||
    before.tgApiId !== after.tgApiId ||
    (after.tgApiHashEncrypted ?? "") !== (before.tgApiHashEncrypted ?? "") ||
    (after.tgPhone ?? "") !== (before.tgPhone ?? "")
  );
}

export function explainTelegramStartBlock(bot: BotConfig) {
  const base = {
    active: Boolean(bot.active),
    hasApiId: false,
    hasApiHash: false,
    hasPhone: Boolean(String(bot.tgPhone || "").trim()),
    hasSession: hasTgSessionOnDisk(bot.id)
  };

  if (!isTelegramBot(bot)) {
    return { ...base, blockReason: "Esta instância não está configurada como Telegram." };
  }
  if (!bot.active) {
    return {
      ...base,
      blockReason: "Instância desativada — em Editar, marque Ativo e salve."
    };
  }

  const apiId = Number(bot.tgApiId || 0);
  base.hasApiId = Number.isFinite(apiId) && apiId > 0;

  let apiHash = "";
  try {
    if (bot.tgApiHashEncrypted) {
      apiHash = decryptSecret(bot.tgApiHashEncrypted);
      base.hasApiHash = Boolean(apiHash);
    }
  } catch {
    return {
      ...base,
      blockReason: "api_hash não pôde ser lido — cole de novo em Editar instância e salve."
    };
  }

  if (!base.hasApiId) {
    return { ...base, blockReason: "Falta api_id — salve em Editar instância (my.telegram.org)." };
  }
  if (!base.hasApiHash) {
    return { ...base, blockReason: "Falta api_hash — cole em Editar instância e salve." };
  }
  if (!base.hasPhone && !base.hasSession) {
    return {
      ...base,
      blockReason: "Informe o telefone com DDI (+5511...) em Editar instância e salve."
    };
  }

  const cached = lastStartErrors.get(bot.id);
  if (cached) return { ...base, blockReason: cached };

  const exit = lastExitCodes.get(bot.id);
  if (exit != null && !processes.has(bot.id)) {
    return {
      ...base,
      blockReason: `Motor encerrou (código ${exit}). Clique em Reiniciar motor.`
    };
  }

  return base;
}

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
  await writeAiRuntimeFile(bot);
}

async function writeAiRuntimeFile(bot: BotConfig) {
  const instDir = instanceDataDir(bot.id);
  const owner = bot.userId ? await getUserById(bot.userId).catch(() => null) : null;
  let payload: Record<string, string> = {
    apiKey: "",
    model: env.OPENAI_MODEL,
    provider: "openai",
    baseURL: "",
    updatedAt: new Date().toISOString()
  };
  try {
    const ai = await resolveBotAIConfig(bot, owner?.email);
    const cfg = AI_PROVIDERS[ai.provider];
    payload = {
      apiKey: ai.apiKey,
      model: ai.model,
      provider: ai.provider,
      baseURL: cfg.baseURL || "",
      updatedAt: new Date().toISOString()
    };
    console.log(`[tg] ai-runtime ${bot.name}: ${ai.provider} · ${ai.model} · key ${ai.apiKey.slice(0, 7)}…`);
  } catch (err) {
    console.warn(`[tg] ai-runtime ${bot.name} vazio: ${err instanceof Error ? err.message : err}`);
    if (env.OPENAI_API_KEY) {
      payload = {
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL,
        provider: "openai",
        baseURL: "",
        updatedAt: new Date().toISOString()
      };
      console.log(`[tg] ai-runtime ${bot.name}: fallback OPENAI_API_KEY do ambiente`);
    }
  }
  await fs.writeFile(path.join(instDir, "ai-runtime.json"), JSON.stringify(payload, null, 2), {
    mode: 0o600
  });
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
  lastStartErrors.delete(bot.id);

  if (!isTelegramBot(bot)) {
    lastStartErrors.set(bot.id, "Instância não é Telegram.");
    writeTelegramBootStatus(bot.id, "error", lastStartErrors.get(bot.id));
    return;
  }
  if (!bot.active) {
    lastStartErrors.set(bot.id, "Instância desativada.");
    writeTelegramBootStatus(bot.id, "offline", lastStartErrors.get(bot.id));
    return;
  }
  if (processes.has(bot.id)) return;

  const apiId = Number(bot.tgApiId || 0);
  let apiHash = "";
  try {
    if (bot.tgApiHashEncrypted) apiHash = decryptSecret(bot.tgApiHashEncrypted);
  } catch {
    apiHash = "";
    lastStartErrors.set(bot.id, "api_hash inválido — salve de novo na edição.");
    writeTelegramBootStatus(bot.id, "error", lastStartErrors.get(bot.id));
    return;
  }
  const phone = String(bot.tgPhone || "").trim();

  if (!apiId || !apiHash) {
    const msg = !apiId
      ? "Falta api_id (my.telegram.org) — salve na edição da instância."
      : "Falta api_hash — cole na edição da instância e salve.";
    lastStartErrors.set(bot.id, msg);
    writeTelegramBootStatus(bot.id, "error", msg);
    console.error(`[tg] ${bot.name}: ${msg}`);
    return;
  }

  const instDir = instanceDataDir(bot.id);
  await restoreTgSessionFromDb(bot.id, instDir);
  if (!phone && !hasTgSessionOnDisk(bot.id)) {
    const msg = "Informe o telefone com DDI (+5511...) na edição da instância.";
    lastStartErrors.set(bot.id, msg);
    writeTelegramBootStatus(bot.id, "error", msg);
    console.error(`[tg] ${bot.name}: ${msg}`);
    return;
  }

  writeTelegramBootStatus(bot.id, "booting");

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
    TG_USE_WSS: "false",
    UPLOADS_DIR: uploadsDir,
    NODE_PATH: path.join(telegramDir, "node_modules")
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
    if (line) {
      lastChildStderr.set(bot.id, line);
      console.error(`[tg:${bot.name}:${port}] ${line}`);
    }
  });
  child.on("exit", (code) => {
    processes.delete(bot.id);
    lastExitCodes.set(bot.id, code ?? null);
    if (code !== 0 && code !== null) {
      const tail = lastChildStderr.get(bot.id);
      const msg = tail || `Motor Telegram encerrou (code ${code})`;
      lastStartErrors.set(bot.id, msg);
      writeTelegramBootStatus(bot.id, "error", msg);
    }
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
      if (st === "booting" || st === "connecting" || st === "sending_code") return st;
      if (st) return st;
    }
  } catch {
    // ignore
  }
  return proc.child.exitCode == null ? "starting" : "offline";
}

export async function getTelegramStatusPayload(botId: string, botHint?: BotConfig) {
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

  const bot = botHint ?? (await loadBots()).find((b) => b.id === botId);
  const diag = bot ? explainTelegramStartBlock(bot) : undefined;

  if (proc) {
    try {
      const res = await fetch(`http://127.0.0.1:${proc.port}/api/status`, {
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const live = (await res.json()) as Record<string, unknown>;
        return {
          ...live,
          diagnostics: diag,
          exitCode: lastExitCodes.get(botId) ?? null
        };
      }
    } catch {
      // fall through to file
    }
  }

  const state = String(file.state || (proc ? "booting" : "offline"));
  const blockReason = diag && "blockReason" in diag ? diag.blockReason : undefined;
  const bootError = lastStartErrors.get(botId);
  const offlineError =
    !proc && blockReason && (state === "offline" || state === "error" || !file.state)
      ? blockReason
      : file.error || bootError;

  return {
    ok: true,
    state: offlineError && !proc && state === "offline" ? "error" : state,
    connected: file.state === "ready" || file.state === "authenticated",
    connectedAs: file.connectedAs,
    error: offlineError,
    pendingCodeHint: file.pendingCodeHint,
    platform: "telegram",
    exitCode: lastExitCodes.get(botId) ?? null,
    diagnostics: diag
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
