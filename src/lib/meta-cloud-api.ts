import { env } from "../config.js";
import { decryptSecret } from "./crypto.js";
import type { BotConfig } from "../bots.js";

const GRAPH = `https://graph.facebook.com/${env.META_GRAPH_VERSION}`;

export function metaAccessToken(bot: BotConfig) {
  if (!bot.metaAccessTokenEncrypted) throw new Error("Token Meta não configurado.");
  return decryptSecret(bot.metaAccessTokenEncrypted);
}

export async function sendMetaTextMessage(input: {
  bot: BotConfig;
  toDigits: string;
  text: string;
}) {
  const token = metaAccessToken(input.bot);
  const phoneNumberId = input.bot.metaPhoneNumberId?.trim();
  if (!phoneNumberId) throw new Error("Phone Number ID Meta não configurado.");

  const to = input.toDigits.replace(/\D/g, "");
  const url = `${GRAPH}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: input.text }
    })
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(err || `Meta API HTTP ${response.status}`);
  }
}

export function verifyMetaWebhook(input: {
  mode?: string;
  token?: string;
  challenge?: string;
  expectedToken: string;
}) {
  if (input.mode === "subscribe" && input.token === input.expectedToken) {
    return input.challenge ?? "";
  }
  return null;
}

export type MetaInboundMessage = {
  from: string;
  text: string;
  messageId: string;
};

export function parseMetaWebhookBody(body: unknown): MetaInboundMessage[] {
  const out: MetaInboundMessage[] = [];
  const entry = (body as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entry)) return out;

  for (const e of entry) {
    const changes = (e as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: { messages?: unknown[] } })?.value;
      const messages = value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const msg of messages) {
        const m = msg as { from?: string; id?: string; type?: string; text?: { body?: string } };
        if (m.type === "text" && m.from && m.text?.body) {
          out.push({ from: m.from, text: m.text.body, messageId: m.id ?? "" });
        }
      }
    }
  }
  return out;
}
