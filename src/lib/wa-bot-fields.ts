import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "./crypto.js";
import type { BotConfig } from "../bots.js";
import { parseWaApiProvider } from "./wa-api-types.js";
import { buildProxyUrl, parseProxyUrl } from "./wa-proxy.js";
import { AI_PROVIDERS, normalizeAIProvider, sanitizeAIModel } from "./ai-providers.js";

export function defaultMetaVerifyToken() {
  return randomBytes(16).toString("hex");
}

export function applyWaFieldsFromForm(
  bot: BotConfig,
  fields: {
    waApiProvider?: string;
    waPhoneNumber?: string;
    proxyEnabled?: string;
    proxyType?: string;
    proxyHost?: string;
    proxyPort?: string;
    proxyUsername?: string;
    proxyPassword?: string;
    proxyUrl?: string;
    metaPhoneNumberId?: string;
    metaAccessToken?: string;
    metaVerifyToken?: string;
  }
): BotConfig {
  const waApiProvider = parseWaApiProvider(fields.waApiProvider ?? bot.waApiProvider);
  const proxyEnabled = fields.proxyEnabled === "true";
  const waPhoneDigits = (fields.waPhoneNumber ?? bot.waPhoneNumber ?? "").replace(/\D/g, "");
  if (waPhoneDigits && (waPhoneDigits.length < 10 || waPhoneDigits.length > 15)) {
    throw new Error("Número WhatsApp inválido — use DDI+DDD+número (10 a 15 dígitos).");
  }
  let builtProxy = buildProxyUrl(fields);

  if (proxyEnabled && !fields.proxyPassword?.trim() && bot.proxyUrlEncrypted && fields.proxyHost?.trim()) {
    try {
      const old = parseProxyUrl(decryptSecret(bot.proxyUrlEncrypted));
      if (old?.password && old.host === fields.proxyHost.trim()) {
        builtProxy = buildProxyUrl({ ...fields, proxyPassword: old.password });
      }
    } catch {
      // ignore
    }
  }

  const next: BotConfig = {
    ...bot,
    waApiProvider,
    waPhoneNumber: waPhoneDigits,
    proxyEnabled,
    metaPhoneNumberId: fields.metaPhoneNumberId?.trim() || bot.metaPhoneNumberId || "",
    metaVerifyToken: fields.metaVerifyToken?.trim() || bot.metaVerifyToken || defaultMetaVerifyToken()
  };

  if (proxyEnabled && builtProxy) {
    next.proxyUrlEncrypted = encryptSecret(builtProxy);
  } else if (!proxyEnabled) {
    next.proxyUrlEncrypted = undefined;
  } else if (builtProxy) {
    next.proxyUrlEncrypted = encryptSecret(builtProxy);
  }

  const metaToken = fields.metaAccessToken?.trim();
  if (metaToken) {
    next.metaAccessTokenEncrypted = encryptSecret(metaToken);
  }

  return next;
}

export function applyAIFieldsFromForm(
  bot: BotConfig,
  fields: { aiProvider?: string; aiModel?: string; aiApiKey?: string }
): BotConfig {
  const provider = normalizeAIProvider(fields.aiProvider ?? bot.aiProvider);
  const cfg = AI_PROVIDERS[provider];
  const next: BotConfig = {
    ...bot,
    aiProvider: provider,
    aiModel: sanitizeAIModel(provider, fields.aiModel?.trim() || bot.aiModel || cfg.defaultModel)
  };
  const key = fields.aiApiKey?.trim();
  if (key) {
    next.aiApiKeyEncrypted = encryptSecret(key);
  }
  return next;
}
