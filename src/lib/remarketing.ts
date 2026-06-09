import type { BotConfig } from "../bots.js";
import { listLeadsByBot } from "../db/events.js";
import { jidFromChatId, sendWaMessage } from "../whatsapp-runtime.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendRemarketing(input: {
  config: BotConfig;
  messages: { chatId: number; message: string }[];
  sequence?: string[];
  sequenceDelayMs?: number;
}) {
  const leads = await listLeadsByBot(input.config.id);
  if (leads.length === 0) {
    return { sent: 0, failed: 0, skipped: 0, total: 0 };
  }

  const byChat = new Map(input.messages.map((m) => [m.chatId, m.message.trim()]));
  const sequence = (input.sequence ?? []).map((s) => s.trim()).filter(Boolean);
  const delayMs = Math.max(0, input.sequenceDelayMs ?? 0);
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
        if (i > 0 && delayMs > 0) await sleep(delayMs);
        await sendWaMessage({ botId: input.config.id, jid, message: toSend[i] });
        sent++;
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
      sequenceDelayMs: input.sequenceDelayMs
    });
    sent += result.sent;
    failed += result.failed;
    skipped += result.skipped;
    total += result.total;
  }

  return { sent, failed, skipped, total };
}
