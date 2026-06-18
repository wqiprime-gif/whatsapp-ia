import type { BotConfig } from "../bots.js";
import { listLeadsByBot, listLeadsWithoutPurchaseForBot } from "../db/events.js";
import { jidFromChatId, sendWaMessage } from "../whatsapp-runtime.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomBetween(min: number, max: number) {
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function leadsForBot(botId: string, audience: "all" | "no_purchase") {
  if (audience === "no_purchase") {
    return listLeadsWithoutPurchaseForBot(botId);
  }
  return listLeadsByBot(botId);
}

export async function sendRemarketing(input: {
  config: BotConfig;
  messages: { chatId: number; message: string }[];
  sequence?: string[];
  sequenceDelayMs?: number;
  audience?: "all" | "no_purchase";
  randomize?: boolean;
  randomDelayMinMs?: number;
  randomDelayMaxMs?: number;
}) {
  let leads = await leadsForBot(input.config.id, input.audience ?? "all");
  if (leads.length === 0) {
    return { sent: 0, failed: 0, skipped: 0, total: 0 };
  }

  if (input.randomize && leads.length > 1) {
    leads = shuffle(leads);
  }

  const byChat = new Map(input.messages.map((m) => [m.chatId, m.message.trim()]));
  const sequence = (input.sequence ?? []).map((s) => s.trim()).filter(Boolean);
  const baseDelayMs = Math.max(0, input.sequenceDelayMs ?? 0);
  const randMin = input.randomDelayMinMs ?? baseDelayMs;
  const randMax = Math.max(randMin, input.randomDelayMaxMs ?? baseDelayMs);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const lead of leads) {
    const personal = byChat.get(lead.chatId);
    const toSend: string[] = [];
    if (sequence.length > 0) toSend.push(...sequence);
    if (personal) toSend.push(personal);
    if (toSend.length === 0) {
      skipped++;
      continue;
    }

    try {
      const jid = jidFromChatId(lead.chatId);
      for (let i = 0; i < toSend.length; i++) {
        if (i > 0) {
          const delay = input.randomize ? randomBetween(randMin, randMax) : baseDelayMs;
          if (delay > 0) await sleep(delay);
        }
        await sendWaMessage({ botId: input.config.id, jid, message: toSend[i] });
        sent++;
      }
      if (input.randomize && baseDelayMs > 0) {
        await sleep(randomBetween(randMin, randMax));
      }
    } catch (error) {
      console.error(`Remarketing falhou chat ${lead.chatId}:`, error);
      failed++;
    }
  }

  return { sent, failed, skipped, total: leads.length };
}

export async function sendRemarketingMulti(input: {
  bots: BotConfig[];
  messagesByBot: Map<string, { chatId: number; message: string }[]>;
  sequence: string[];
  sequenceDelayMs: number;
  audience?: "all" | "no_purchase";
  randomize?: boolean;
  randomDelayMinMs?: number;
  randomDelayMaxMs?: number;
}) {
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let total = 0;

  for (const config of input.bots) {
    if (!config.active) continue;
    const messages = input.messagesByBot.get(config.id) ?? [];
    const result = await sendRemarketing({
      config,
      messages,
      sequence: input.sequence,
      sequenceDelayMs: input.sequenceDelayMs,
      audience: input.audience,
      randomize: input.randomize,
      randomDelayMinMs: input.randomDelayMinMs,
      randomDelayMaxMs: input.randomDelayMaxMs
    });
    sent += result.sent;
    failed += result.failed;
    skipped += result.skipped;
    total += result.total;
  }

  return { sent, failed, skipped, total };
}
