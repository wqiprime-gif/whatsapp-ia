import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { ensureDataFile, loadBots } from "./bots.js";
import { env } from "./config.js";
import { initDatabase, useDatabase } from "./db/index.js";
import { registerPanelRoutes } from "./panel/routes.js";
import {
  restartWhatsAppBots,
  shutdownWhatsAppBots
} from "./whatsapp-runtime.js";

export async function restartBots() {
  await restartWhatsAppBots();
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
console.log("[startup] BotManager WhatsApp online na porta", env.PORT);
console.log("[startup] Banco:", useDatabase() ? "PostgreSQL OK" : "arquivos locais (data/)");
console.log("[startup] Instâncias cadastradas:", botsOnStart);
console.log("[startup] Painel:", `${localBase}/login`);
console.log("[startup] Health:", `${localBase}/health`);

void restartBots().catch((error) => console.error("Erro ao iniciar instâncias WA:", error));

const { processDueScheduledCampaigns } = await import("./lib/scheduled-campaigns.js");
setInterval(() => {
  void processDueScheduledCampaigns().catch((error) =>
    console.error("[schedule] Erro ao processar campanhas:", error)
  );
}, 30_000);
void processDueScheduledCampaigns().catch((error) =>
  console.error("[schedule] Erro na verificação inicial:", error)
);

process.once("SIGINT", () => {
  void shutdownWhatsAppBots();
});
process.once("SIGTERM", () => {
  void shutdownWhatsAppBots();
});
