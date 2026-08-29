import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";
import fs from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import { ensureDataFile, loadBots } from "./bots.js";
import { env } from "./config.js";
import { initDatabase, useDatabase } from "./db/index.js";
import { registerPanelRoutes } from "./panel/routes.js";
import {
  ensureWhatsAppBotsRunning,
  restartSingleWhatsAppBot,
  restartWhatsAppBots,
  shutdownWhatsAppBots,
  syncWhatsAppBotConfigs
} from "./whatsapp-runtime.js";
import {
  ensureTelegramBotsRunning,
  restartSingleTelegramBot,
  restartTelegramBots,
  shutdownTelegramBots,
  syncTelegramBotConfigs
} from "./telegram-runtime.js";
import { getBotByIdAny } from "./bots.js";
import { isTelegramBot } from "./lib/platform-types.js";

export async function restartBots() {
  await Promise.all([restartWhatsAppBots(), restartTelegramBots()]);
}

export async function ensureBots() {
  await Promise.all([ensureWhatsAppBotsRunning(), ensureTelegramBotsRunning()]);
}

export async function syncBots() {
  await Promise.all([syncWhatsAppBotConfigs(), syncTelegramBotConfigs()]);
}

export async function restartBot(botId: string) {
  const bot = await getBotByIdAny(botId);
  if (bot && isTelegramBot(bot)) {
    await restartSingleTelegramBot(botId);
    return;
  }
  await restartSingleWhatsAppBot(botId);
}

const WA_SESSION_BODY_LIMIT = 100 * 1024 * 1024;

const app = Fastify({ logger: true, bodyLimit: WA_SESSION_BODY_LIMIT });
app.addContentTypeParser(
  "application/octet-stream",
  { parseAs: "buffer", bodyLimit: WA_SESSION_BODY_LIMIT },
  (_req, body, done) => {
    done(null, body);
  }
);
await app.register(formbody);
await app.register(multipart, {
  limits: { fileSize: 100 * 1024 * 1024, files: 20 }
});

await initDatabase();
if (!useDatabase()) {
  const { initUsersSchema } = await import("./db/users.js");
  await initUsersSchema();
  const { initChipWarmerSchema } = await import("./lib/chip-warmer.js");
  await initChipWarmerSchema();
}
await registerPanelRoutes(app, {
  restartBots: () => {
    void restartBots().catch((error) => console.error("Erro ao reiniciar bots:", error));
  },
  restartBot: (botId: string) => {
    void restartBot(botId).catch((error) =>
      console.error(`Erro ao reiniciar bot ${botId}:`, error)
    );
  },
  ensureBots: () => {
    void ensureBots().catch((error) => console.error("Erro ao subir bots:", error));
  },
  syncBots: () => {
    void syncBots().catch((error) => console.error("Erro ao sincronizar bots:", error));
  }
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });

await ensureDataFile();
let botsOnStart = 0;
try {
  botsOnStart = (await loadBots()).length;
} catch (error) {
  console.error("[startup] Erro ao carregar bots (painel segue online):", error);
}
const localBase = `http://127.0.0.1:${env.PORT}`;
console.log("[startup] X1 BLACK online na porta", env.PORT);
console.log("[startup] DATA_DIR:", env.DATA_DIR);
const markerPath = path.join(env.DATA_DIR, ".zap-volume-marker");
let hadPreviousBoot = false;
try {
  await fs.mkdir(env.DATA_DIR, { recursive: true });
  const probe = path.join(env.DATA_DIR, ".writable-probe");
  await fs.writeFile(probe, "ok", "utf8");
  await fs.unlink(probe);

  try {
    const prev = await fs.readFile(markerPath, "utf8");
    if (prev.trim()) hadPreviousBoot = true;
  } catch {
    hadPreviousBoot = false;
  }
  await fs.writeFile(markerPath, new Date().toISOString(), "utf8");

  const authDir = path.join(env.DATA_DIR, "wwebjs_auth");
  let sessionCount = 0;
  try {
    const entries = await fs.readdir(authDir);
    sessionCount = entries.filter((n) => n.startsWith("session-")).length;
  } catch {
    sessionCount = 0;
  }

  if (!hadPreviousBoot && sessionCount === 0) {
    console.warn(
      "[startup] ⚠️ Volume /data SEM histórico — primeiro deploy ou volume Railway não montado. Após conectar o QR, as sessões ficam em /data/wwebjs_auth."
    );
  } else if (hadPreviousBoot && sessionCount === 0) {
    console.warn(
      "[startup] ⚠️ Volume resetou ou sessões sumiram — será necessário QR de novo. Confira Volume Railway montado em /data."
    );
  } else {
    console.log(`[startup] Volume OK · ${sessionCount} sessão(ões) WhatsApp em disco`);
  }

  if (useDatabase()) {
    try {
      const { countWaSessionBackups } = await import("./db/wa-session.js");
      const dbBackups = await countWaSessionBackups();
      if (dbBackups > 0) {
        console.log(`[startup] PostgreSQL · ${dbBackups} backup(s) de sessão WhatsApp (reconexão automática após deploy)`);
      } else if (!hadPreviousBoot || sessionCount === 0) {
        console.log(
          "[startup] PostgreSQL · nenhum backup de sessão ainda — após escanear o QR, a sessão será salva no banco"
        );
      }
    } catch {
      // ignore
    }
  }
} catch (error) {
  console.warn(
    "[startup] ⚠️ DATA_DIR não gravável — monte um volume Railway em /data ou a sessão cai a cada deploy:",
    error instanceof Error ? error.message : error
  );
}
console.log("[startup] Banco:", useDatabase() ? "PostgreSQL OK" : "arquivos locais (data/)");
console.log("[startup] Instâncias cadastradas:", botsOnStart);
console.log("[startup] Painel:", `${localBase}/login`);
console.log("[startup] Health:", `${localBase}/health`);

void ensureBots().catch((error) => console.error("Erro ao iniciar instâncias WhatsApp:", error));
void import("./lib/maturation-sync.js")
  .then((m) => m.syncAllMaturationModes())
  .catch((error) => console.error("[maturador] sync inicial:", error));

const { processDueScheduledCampaigns } = await import("./lib/scheduled-campaigns.js");
setInterval(() => {
  void processDueScheduledCampaigns().catch((error) =>
    console.error("[schedule] Erro ao processar campanhas:", error)
  );
}, 30_000);
void processDueScheduledCampaigns().catch((error) =>
  console.error("[schedule] Erro na verificação inicial:", error)
);

const { processDuePostSaleJobs } = await import("./lib/post-sale-scheduler.js");
setInterval(() => {
  void processDuePostSaleJobs().catch((error) =>
    console.error("[post-sale] Erro ao processar jobs:", error)
  );
}, 60_000);
void processDuePostSaleJobs().catch((error) =>
  console.error("[post-sale] Erro na verificação inicial:", error)
);

const { processChipWarmerTick } = await import("./lib/chip-warmer-scheduler.js");
setInterval(() => {
  void processChipWarmerTick().catch((error) =>
    console.error("[chip-warmer] Erro no tick:", error)
  );
}, 60_000);
void processChipWarmerTick().catch((error) =>
  console.error("[chip-warmer] Erro na verificação inicial:", error)
);

let appShuttingDown = false;

async function onShutdownSignal(signal: string) {
  if (appShuttingDown) return;
  appShuttingDown = true;
  console.log(`[shutdown] ${signal} — salvando sessões antes de encerrar...`);
  try {
    await Promise.all([shutdownWhatsAppBots(), shutdownTelegramBots()]);
  } catch (error) {
    console.error("[shutdown] Erro ao encerrar bots:", error);
  }
  try {
    await app.close();
  } catch {
    // ignore
  }
  process.exit(0);
}

process.once("SIGINT", () => {
  void onShutdownSignal("SIGINT");
});
process.once("SIGTERM", () => {
  void onShutdownSignal("SIGTERM");
});
