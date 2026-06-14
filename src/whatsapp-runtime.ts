import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { loadBots, uploadsDir, type BotConfig } from "./bots.js";
import { env, rootDir } from "./config.js";
import { decryptSecret } from "./lib/crypto.js";
import { sendMetaTextMessage } from "./lib/meta-cloud-api.js";
import { puppeteerProxyArgs } from "./lib/wa-proxy.js";
import { getOpenAIApiKey } from "./lib/settings.js";

const hotbotDir = path.join(rootDir, "hotbot");
const instancesDir = path.join(env.DATA_DIR, "wa-instances");

function instanceDataDir(botId: string) {
  return path.join(instancesDir, botId);
}

type WaProcess = {
  child: ChildProcess;
  port: number;
  botId: string;
};

const processes = new Map<string, WaProcess>();
const metaBots = new Map<string, BotConfig>();
const lastExitCodes = new Map<string, number | null>();

function stablePort(botId: string, index: number) {
  const hash = parseInt(botId.replace(/\D/g, "").slice(0, 8), 10) || index;
  return 4100 + (hash % 800) + index;
}

export function waPortForBot(botId: string, index = 0) {
  return stablePort(botId, index);
}

function chatIdFromWaJid(jid: string) {
  const digits = jid.replace(/@.*/, "").replace(/\D/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

export { chatIdFromWaJid };

function isMetaBot(bot: BotConfig) {
  return bot.waApiProvider === "meta_cloud";
}

function proxyUrlForBot(bot: BotConfig) {
  if (!bot.proxyEnabled || !bot.proxyUrlEncrypted) return "";
  try {
    return decryptSecret(bot.proxyUrlEncrypted);
  } catch {
    return "";
  }
}

async function syncBotFiles(bot: BotConfig, port: number) {
  const instDir = path.join(instancesDir, bot.id);
  const promptsDir = path.join(hotbotDir, "prompts");
  await fs.mkdir(instDir, { recursive: true });
  await fs.mkdir(promptsDir, { recursive: true });

  await fs.writeFile(
    path.join(promptsDir, `${bot.id}-prompt.json`),
    JSON.stringify({ prompt: bot.prompt, pixKey: bot.pixKey, pixRecipientName: bot.pixRecipientName }, null, 2)
  );

  await fs.writeFile(
    path.join(instDir, "meta.json"),
    JSON.stringify(
      {
        botId: bot.id,
        port,
        name: bot.name,
        waApiProvider: bot.waApiProvider ?? "whatsapp_web",
        proxyEnabled: Boolean(bot.proxyEnabled),
        updatedAt: new Date().toISOString()
      },
      null,
      2
    )
  );

  await fs.writeFile(
    path.join(instDir, "bot-config.json"),
    JSON.stringify(
      {
        previewMediaUrls: bot.previewMediaUrls ?? [],
        deliveryMediaUrls: bot.deliveryMediaUrls ?? [],
        pixKey: bot.pixKey,
        pixRecipientName: bot.pixRecipientName || bot.name,
        productName: bot.productName,
        productPriceCents: bot.productPriceCents,
        paymentMethod: bot.paymentMethod,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    )
  );
}

async function spawnWebBot(bot: BotConfig, port: number) {
  await syncBotFiles(bot, port);

  const apiKey = await getOpenAIApiKey(bot.userId).catch(() => env.OPENAI_API_KEY);
  const proxyUrl = proxyUrlForBot(bot);
  const instDir = instanceDataDir(bot.id);
  await fs.mkdir(instDir, { recursive: true });

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    OPENAI_API_KEY: apiKey || process.env.OPENAI_API_KEY || "",
    PANEL_URL: `http://127.0.0.1:${env.PORT}`,
    INTERNAL_SECRET: env.INTERNAL_SECRET,
    BOT_ID: bot.id,
    PIX_KEY: bot.pixKey,
    PIX_RECIPIENT: bot.pixRecipientName || bot.name,
    WA_AUTH_DIR: path.join(env.DATA_DIR, "wwebjs_auth"),
    WA_INSTANCE_DIR: instDir,
    UPLOADS_DIR: uploadsDir
  };
  if (proxyUrl) childEnv.PROXY_URL = proxyUrl;

  const args = [
    path.join(hotbotDir, "bot-instance.js"),
    "--port",
    String(port),
    "--clientId",
    `wa-${bot.id.slice(0, 8)}`,
    "--modelName",
    bot.name,
    "--sessionId",
    bot.id
  ];
  if (proxyUrl) args.push("--proxy", proxyUrl);

  const child = spawn(process.execPath, args, {
    cwd: hotbotDir,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout?.on("data", (chunk) => {
    const line = String(chunk).trim();
    if (line) console.log(`[wa-web:${bot.name}:${port}] ${line}`);
  });
  child.stderr?.on("data", (chunk) => {
    const line = String(chunk).trim();
    if (line) console.error(`[wa-web:${bot.name}:${port}] ${line}`);
  });
  child.on("exit", (code) => {
    processes.delete(bot.id);
    lastExitCodes.set(bot.id, code ?? null);
    console.log(`[wa-web] ${bot.name} encerrou (code ${code ?? "?"})`);
  });

  processes.set(bot.id, { child, port, botId: bot.id });
  const proxyNote = bot.proxyEnabled ? " · proxy isolado" : "";
  console.log(`[wa-web] ${bot.name} iniciado na porta ${port}${proxyNote}`);
}

function registerMetaBot(bot: BotConfig) {
  metaBots.set(bot.id, bot);
  console.log(`[wa-meta] ${bot.name} registrado (Phone ID ${bot.metaPhoneNumberId || "?"})`);
}

async function killWebBot(botId: string) {
  const proc = processes.get(botId);
  if (!proc) return;
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      try {
        proc.child.kill("SIGKILL");
      } catch {
        // ignore
      }
      processes.delete(botId);
      resolve();
    }, 5000);
    proc.child.once("exit", () => {
      clearTimeout(timer);
      processes.delete(botId);
      resolve();
    });
    try {
      proc.child.kill("SIGTERM");
    } catch {
      clearTimeout(timer);
      processes.delete(botId);
      resolve();
    }
  });
}

let restartInProgress = false;

export async function restartWhatsAppBots() {
  if (restartInProgress) return;
  restartInProgress = true;
  try {
    await Promise.all([...processes.keys()].map((id) => killWebBot(id)));
    metaBots.clear();

    const bots = await loadBots();
    let index = 0;
    for (const bot of bots) {
      if (!bot.active) continue;
      try {
        if (isMetaBot(bot)) {
          if (!bot.metaPhoneNumberId?.trim() || !bot.metaAccessTokenEncrypted) {
            console.warn(`[wa-meta] ${bot.name}: configure Phone ID e token Meta.`);
            continue;
          }
          registerMetaBot(bot);
        } else {
          const port = bot.waPort ?? waPortForBot(bot.id, index);
          index++;
          await spawnWebBot(bot, port);
        }
      } catch (error) {
        console.error(`[wa] Falha ao iniciar ${bot.name}:`, error);
      }
    }
  } finally {
    restartInProgress = false;
  }
}

export async function shutdownWhatsAppBots() {
  await Promise.all([...processes.keys()].map((id) => killWebBot(id)));
  metaBots.clear();
}

export function getWaProcess(botId: string) {
  return processes.get(botId) ?? null;
}

export function getMetaBot(botId: string) {
  return metaBots.get(botId) ?? null;
}

export type WaLiveStatus =
  | "paused"
  | "offline"
  | "starting"
  | "qr_pending"
  | "connected"
  | "disconnected"
  | "auth_failure"
  | "error"
  | "meta_ready"
  | "meta_missing";

type WaRuntimeState = {
  state: string;
  connected: boolean;
  qr: string | null;
  error: string | null;
  processRunning: boolean;
};

async function readStatusFile(botId: string): Promise<{ state: string | null; error: string | null }> {
  try {
    const raw = await fs.readFile(path.join(instanceDataDir(botId), "status.json"), "utf8");
    const data = JSON.parse(raw) as { state?: string; error?: string };
    return {
      state: data.state?.trim() || null,
      error: data.error?.trim() || null
    };
  } catch {
    return { state: null, error: null };
  }
}

async function readQrFile(botId: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(instanceDataDir(botId), "qr.json"), "utf8");
    const data = JSON.parse(raw) as { qr?: string };
    return data.qr?.trim() || null;
  } catch {
    return null;
  }
}

async function fetchWebBotState(botId: string): Promise<WaRuntimeState> {
  const proc = processes.get(botId);
  const fileStatus = await readStatusFile(botId);
  const fileQr = await readQrFile(botId);

  if (proc) {
    try {
      const response = await fetch(`http://127.0.0.1:${proc.port}/api/status`, {
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const data = (await response.json()) as {
          state?: string;
          connected?: boolean;
          error?: string;
        };
        const state = data.state?.trim() || fileStatus.state || "starting";
        const connected = Boolean(data.connected);
        const qr = connected ? null : await readQrFile(botId);
        return {
          state,
          connected,
          qr,
          error: data.error?.trim() || fileStatus.error,
          processRunning: true
        };
      }
    } catch {
      // fallback para arquivos locais
    }
  }

  const exitCode = lastExitCodes.get(botId);
  const exitError =
    exitCode != null && exitCode !== 0
      ? `Motor WhatsApp encerrou (código ${exitCode}). Verifique logs no Railway.`
      : null;
  const connected =
    (fileStatus.state === "ready" || fileStatus.state === "authenticated") && Boolean(proc);
  return {
    state: fileStatus.state || (proc ? "starting" : "offline"),
    connected,
    qr: connected ? null : fileQr,
    error: fileStatus.error || exitError,
    processRunning: Boolean(proc)
  };
}

export async function getWaLiveStatus(bot: BotConfig): Promise<WaLiveStatus> {
  if (!bot.active) return "paused";

  if (isMetaBot(bot)) {
    return bot.metaPhoneNumberId?.trim() && bot.metaAccessTokenEncrypted ? "meta_ready" : "meta_missing";
  }

  const runtime = await fetchWebBotState(bot.id);
  if (runtime.connected) return "connected";
  if (runtime.state === "qr_pending" || runtime.qr) return "qr_pending";
  if (runtime.state === "disconnected") return "disconnected";
  if (runtime.state === "auth_failure") return "auth_failure";
  if (runtime.state === "error" || runtime.error) return "error";
  if (processes.has(bot.id)) return "starting";
  return "offline";
}

export async function getWaLiveStatuses(bots: BotConfig[]) {
  const entries = await Promise.all(bots.map(async (bot) => [bot.id, await getWaLiveStatus(bot)] as const));
  return Object.fromEntries(entries) as Record<string, WaLiveStatus>;
}

export async function readWaQr(botId: string): Promise<{
  qr: string | null;
  connected: boolean;
  state: string;
  error: string | null;
  processRunning: boolean;
}> {
  const bot = (await loadBots()).find((b) => b.id === botId);
  if (bot?.waApiProvider === "meta_cloud") {
    const ok = Boolean(bot.metaPhoneNumberId && bot.metaAccessTokenEncrypted);
    return { qr: null, connected: ok, state: ok ? "meta_ready" : "meta_missing", error: null, processRunning: false };
  }

  const runtime = await fetchWebBotState(botId);
  return {
    qr: runtime.qr,
    connected: runtime.connected,
    state: runtime.state,
    error: runtime.error,
    processRunning: runtime.processRunning
  };
}

export async function sendWaMessage(input: { botId: string; jid: string; message: string }) {
  const bots = await loadBots();
  const bot = bots.find((b) => b.id === input.botId);
  if (!bot) throw new Error("Instância não encontrada.");

  if (isMetaBot(bot)) {
    const digits = input.jid.replace(/@.*/, "").replace(/\D/g, "");
    await sendMetaTextMessage({ bot, toDigits: digits, text: input.message });
    return;
  }

  const proc = processes.get(input.botId);
  if (!proc) throw new Error("Instância WhatsApp Web não está rodando.");
  const url = `http://127.0.0.1:${proc.port}/api/send`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ to: input.jid, message: input.message })
  });
  if (!response.ok) {
    let detail = "";
    try {
      const json = (await response.json()) as { error?: string };
      detail = json.error ?? "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(detail || `Falha ao enviar (HTTP ${response.status})`);
  }
}

export function jidFromChatId(chatId: number) {
  return `${chatId}@c.us`;
}

/** Exportado para bot-instance validar args de proxy no spawn. */
export function proxyArgsForUrl(proxyUrl: string) {
  return puppeteerProxyArgs(proxyUrl);
}
