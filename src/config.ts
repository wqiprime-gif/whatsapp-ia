import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const dirname = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(dirname, "..");

// No Railway as variaveis vem do painel (process.env), nao do arquivo .env local.
const isRailway = Boolean(process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT);
if (!isRailway) {
  // override: true — .env local sobrescreve DATABASE_URL do sistema (evita crash sem Postgres)
  dotenv.config({ path: path.join(rootDir, ".env"), quiet: true, override: true });
}

const envSchema = z.object({
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  PANEL_PASSWORD: z.string().min(6).default("troque-essa-senha"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_NAME: z.string().default("Administrador"),
  INVITE_CODE: z.string().default("BOT2026"),
  SESSION_SECRET: z.string().min(16).optional(),
  PORT: z.coerce.number().default(3001),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  BOT_NAME: z.string().default("Bot Principal"),
  BOT_PROMPT: z.string().default("Voce atende leads no WhatsApp de forma simpatica e objetiva."),
  INTERNAL_SECRET: z.string().min(8).default("wa-internal-secret-v1"),
  PIX_KEY: z.string().default(""),
  MESSAGE_DELAY_MS: z.coerce.number().default(1500),
  PREVIEW_MEDIA_URLS: z.string().default(""),
  DELIVERY_MEDIA_URLS: z.string().default(""),
  DATABASE_URL: z.string().default(""),
  DATABASE_PUBLIC_URL: z.string().default(""),
  DATA_DIR: z.string().default(""),
  LARANJINHA_API_BASE: z.string().default("https://laranjinha.digital/api"),
  META_GRAPH_VERSION: z.string().default("v21.0"),
  PUBLIC_BASE_URL: z.string().default("")
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (parsed.success) {
    const data = parsed.data;
    const databaseUrl = (data.DATABASE_URL || data.DATABASE_PUBLIC_URL || "").trim();
    return {
      ...data,
      DATABASE_URL: databaseUrl,
      SESSION_SECRET: data.SESSION_SECRET || `${data.PANEL_PASSWORD}-session-secret-v1`,
      DATA_DIR: data.DATA_DIR || path.join(rootDir, "data"),
      PUBLIC_BASE_URL: (data.PUBLIC_BASE_URL || "").trim()
    };
  }

  console.error("\n[ERRO] Variaveis de ambiente invalidas.\n");
  console.error("No Railway > Variables, configure pelo menos:");
  console.error("  PANEL_PASSWORD = senha do painel");
  console.error("  OPENAI_API_KEY = opcional se configurar depois no painel\n");
  process.exit(1);
}

export const env = loadEnv();
