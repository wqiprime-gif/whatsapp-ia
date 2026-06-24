import type OpenAI from "openai";
import { createChatCompletionForBot } from "./ai-chat.js";
import type { BotConfig } from "../bots.js";
import { humanizeReceiptRejection } from "./receipt-messages.js";

const BANNED =
  /probleminha|conferir|atendente|recebi seu comprovante|vou verificar|aguarde|motivo:|revisao manual|revisão manual/i;

export function receiptRejectionSeed(reason: string, userMessage?: string) {
  return humanizeReceiptRejection(reason, userMessage);
}

export async function personaReceiptRejection(input: {
  config: BotConfig;
  reason: string;
  userMessage?: string;
  history?: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}) {
  const seed = receiptRejectionSeed(input.reason, input.userMessage);
  const history = input.history ?? [];

  try {
    const completion = await createChatCompletionForBot(input.config, {
      temperature: 0.88,
      max_tokens: 90,
      messages: [
        {
          role: "system",
          content: `${input.config.prompt}

O comprovante NAO foi aprovado. Reescreva a mensagem abaixo no SEU tom de WhatsApp (amor, bb), max 2 frases curtas.
PROIBIDO: probleminha, conferir, atendente, "recebi seu comprovante", linguagem formal.
Ideia base: ${seed}`
        },
        ...history.slice(-6)
      ]
    });
    const text = completion.choices[0]?.message?.content?.trim() || "";
    if (text && !BANNED.test(text)) return text.slice(0, 280);
  } catch {
    // fallback
  }

  const fallback = seed.replace(/conferir|probleminha/gi, "").trim();
  return fallback || "amor, esse print nao deu certo… manda outro? 😘";
}
