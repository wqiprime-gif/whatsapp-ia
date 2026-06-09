import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "./crypto.js";
import type { BotConfig } from "../bots.js";
import { parseWaApiProvider } from "./wa-api-types.js";
import { buildProxyUrl, parseProxyUrl } from "./wa-proxy.js";

export function defaultMetaVerifyToken() {
  return randomBytes(16).toString("hex");
}

export function applyWaFieldsFromForm(
  bot: BotConfig,
  fields: {
    waApiProvider?: string;
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
  const waApiProvider = parseWaApiProvider(fields.waApiProvider);
  const proxyEnabled = fields.proxyEnabled === "true";
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
