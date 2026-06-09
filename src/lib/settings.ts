import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config.js";
import { getPool, useDatabase } from "../db/index.js";
import { decryptSecret, encryptSecret, maskApiKey } from "./crypto.js";
import { AI_PROVIDERS, normalizeAIProvider, type AIProviderId } from "./ai-providers.js";

const settingsFile = path.join(env.DATA_DIR, "settings.json");

export type AppSettings = {
  openaiApiKeyEncrypted?: string;
  openaiModel: string;
  aiProvider: AIProviderId;
};

const defaultSettings: AppSettings = {
  openaiModel: env.OPENAI_MODEL,
  aiProvider: "openai"
};

async function loadSettingsFromFile(userId: string): Promise<AppSettings> {
  const userFile = path.join(env.DATA_DIR, `settings-${userId}.json`);
  try {
    const raw = await fs.readFile(userFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...defaultSettings,
      ...parsed,
      aiProvider: normalizeAIProvider(parsed.aiProvider)
    };
  } catch {
    try {
      const raw = await fs.readFile(settingsFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        ...defaultSettings,
        ...parsed,
        aiProvider: normalizeAIProvider(parsed.aiProvider)
      };
    } catch {
      return { ...defaultSettings };
    }
  }
}

async function loadSettingsFromDb(userId: string): Promise<AppSettings> {
  const { rows } = await getPool().query<{
    openai_api_key_encrypted: string | null;
    openai_model: string;
    ai_provider: string | null;
  }>(
    `SELECT openai_api_key_encrypted, openai_model, ai_provider FROM user_settings WHERE user_id = $1`,
    [userId]
  );

  if (!rows[0]) {
    const legacy = await getPool().query<{
      openai_api_key_encrypted: string | null;
      openai_model: string;
    }>("SELECT openai_api_key_encrypted, openai_model FROM app_settings WHERE id = 1");
    if (legacy.rows[0]) {
      return {
        openaiModel: legacy.rows[0].openai_model || env.OPENAI_MODEL,
        openaiApiKeyEncrypted: legacy.rows[0].openai_api_key_encrypted ?? undefined,
        aiProvider: "openai"
      };
    }
    return { ...defaultSettings };
  }

  return {
    openaiModel: rows[0].openai_model || env.OPENAI_MODEL,
    openaiApiKeyEncrypted: rows[0].openai_api_key_encrypted ?? undefined,
    aiProvider: normalizeAIProvider(rows[0].ai_provider)
  };
}

export async function loadSettings(userId: string): Promise<AppSettings> {
  if (useDatabase()) {
    return loadSettingsFromDb(userId);
  }
  return loadSettingsFromFile(userId);
}

async function saveSettingsToFile(userId: string, settings: AppSettings) {
  await fs.mkdir(env.DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(env.DATA_DIR, `settings-${userId}.json`), JSON.stringify(settings, null, 2));
}

async function saveSettingsToDb(userId: string, settings: AppSettings) {
  await getPool().query(
    `INSERT INTO user_settings (user_id, openai_api_key_encrypted, openai_model, ai_provider, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       openai_api_key_encrypted = EXCLUDED.openai_api_key_encrypted,
       openai_model = EXCLUDED.openai_model,
       ai_provider = EXCLUDED.ai_provider,
       updated_at = NOW()`,
    [userId, settings.openaiApiKeyEncrypted ?? null, settings.openaiModel, settings.aiProvider]
  );
}

export async function saveSettings(userId: string, settings: AppSettings) {
  if (useDatabase()) {
    return saveSettingsToDb(userId, settings);
  }
  return saveSettingsToFile(userId, settings);
}

export async function getOpenAIApiKey(userId: string): Promise<string> {
  const settings = await loadSettings(userId);
  if (settings.openaiApiKeyEncrypted) {
    return decryptSecret(settings.openaiApiKeyEncrypted);
  }
  if (env.OPENAI_API_KEY) {
    return env.OPENAI_API_KEY;
  }
  throw new Error("Configure a API Key de IA em Configuracoes no painel.");
}

export async function getOpenAIModel(userId: string): Promise<string> {
  const settings = await loadSettings(userId);
  return settings.openaiModel || env.OPENAI_MODEL;
}

export async function getAIProvider(userId: string): Promise<AIProviderId> {
  const settings = await loadSettings(userId);
  return settings.aiProvider;
}

export async function getOpenAI(userId: string) {
  const { getOpenAIClient } = await import("./ai-chat.js");
  return getOpenAIClient(userId);
}

export async function getApiKeyStatus(userId: string) {
  const settings = await loadSettings(userId);
  const provider = AI_PROVIDERS[settings.aiProvider];
  if (settings.openaiApiKeyEncrypted) {
    try {
      const key = decryptSecret(settings.openaiApiKeyEncrypted);
      return {
        configured: true,
        masked: maskApiKey(key),
        source: "painel" as const,
        provider: settings.aiProvider,
        providerLabel: provider.label
      };
    } catch {
      return {
        configured: false,
        masked: "",
        source: "painel" as const,
        provider: settings.aiProvider,
        providerLabel: provider.label
      };
    }
  }
  if (env.OPENAI_API_KEY) {
    return {
      configured: true,
      masked: maskApiKey(env.OPENAI_API_KEY),
      source: "env" as const,
      provider: "openai" as const,
      providerLabel: "OpenAI (env)"
    };
  }
  return {
    configured: false,
    masked: "",
    source: "none" as const,
    provider: settings.aiProvider,
    providerLabel: provider.label
  };
}

export async function updateOpenAISettings(
  userId: string,
  input: { apiKey?: string; model?: string; provider?: string }
) {
  const current = await loadSettings(userId);
  const provider = normalizeAIProvider(input.provider ?? current.aiProvider);
  const defaultModel = AI_PROVIDERS[provider].defaultModel;

  const next: AppSettings = {
    aiProvider: provider,
    openaiModel: input.model?.trim() || current.openaiModel || defaultModel || env.OPENAI_MODEL
  };

  if (input.apiKey?.trim()) {
    next.openaiApiKeyEncrypted = encryptSecret(input.apiKey.trim());
  } else if (current.openaiApiKeyEncrypted) {
    next.openaiApiKeyEncrypted = current.openaiApiKeyEncrypted;
  }

  await saveSettings(userId, next);
  return next;
}
