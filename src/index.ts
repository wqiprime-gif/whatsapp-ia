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

export async function restartBots() {
  await restartWhatsAppBots();
}

export async function ensureBots() {
  await ensureWhatsAppBotsRunning();
}

export async function syncBots() {
  await syncWhatsAppBotConfigs();
}

const app = Fastify({ logger: true });
await app.register(formbody);
await app.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024, files: 20 }
});

await initDatabase();
if (!useDatabase()) {
  const { initUsersSchema } = await import("./db/users.js");
  await initUsersSchema();
}
await registerPanelRoutes(app, {
  restartBots: () => {
    void restartBots().catch((error) => console.error("Erro ao reiniciar bots:", error));
  },
  restartBot: (botId: string) => {
    void restartSingleWhatsAppBot(botId).catch((error) =>
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
console.log("[startup] ZapManager WhatsApp online na porta", env.PORT);
console.log("[startup] DATA_DIR:", env.DATA_DIR);
try {
  await fs.mkdir(env.DATA_DIR, { recursive: true });
  const probe = path.join(env.DATA_DIR, ".writable-probe");
  await fs.writeFile(probe, "ok", "utf8");
  await fs.unlink(probe);
  console.log("[startup] DATA_DIR gravável: sim (sessão WhatsApp persiste entre deploys)");
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

void ensureBots().catch((error) => console.error("Erro ao iniciar instâncias WA:", error));

const { processDueScheduledCampaigns } = await import("./lib/scheduled-campaigns.js");
setInterval(() => {
  void processDueScheduledCampaigns().catch((error) =>
    console.error("[schedule] Erro ao processar campanhas:", error)
  );
}, 30_000);
void processDueScheduledCampaigns().catch((error) =>
  console.error("[schedule] Erro na verificação inicial:", error)
);

let appShuttingDown = false;

async function onShutdownSignal(signal: string) {
  if (appShuttingDown) return;
  appShuttingDown = true;
  console.log(`[shutdown] ${signal} — salvando sessões WhatsApp antes de encerrar...`);
  try {
    await shutdownWhatsAppBots();
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
