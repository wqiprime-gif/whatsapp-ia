import type { Telegraf } from "telegraf";

export function humanDelayMs(baseMs: number, extraBetween = false) {
  const jitter = 0.7 + Math.random() * 0.8;
  const thinkingPause = Math.random() < 0.25 ? 1200 + Math.random() * 4000 : 0;
  const betweenBoost = extraBetween ? 800 + Math.random() * 2200 : 0;
  return Math.max(1200, Math.round(baseMs * jitter + thinkingPause + betweenBoost));
}

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function humanPause(baseMs: number, extraBetween = false) {
  await sleep(humanDelayMs(baseMs, extraBetween));
}

export async function typingAndPause(
  telegram: Telegraf["telegram"],
  chatId: number,
  baseMs: number,
  extraBetween = false
) {
  await telegram.sendChatAction(chatId, "typing");
  await humanPause(baseMs, extraBetween);
}

/** Divide resposta da IA em bolhas separadas (como pessoa digitando). */
export function splitReplyChunks(text: string, maxLen = 220): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;

  const sentences = normalized.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g)?.map((s) => s.trim()) ?? [normalized];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!sentence) continue;
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length <= maxLen) {
      current = next;
      continue;
    }
    if (current) chunks.push(current);
    current = sentence.length <= maxLen ? sentence : sentence.slice(0, maxLen);
  }
  if (current) chunks.push(current);

  return chunks.length > 0 ? chunks : [normalized];
}

const PREVIEW_INTROS = [
  "Segue uma previa pra você.",
  "Olha só o que preparei.",
  "Te mandei uma amostrinha.",
  "Confere essa previa."
];

export function randomPreviewIntro() {
  return PREVIEW_INTROS[Math.floor(Math.random() * PREVIEW_INTROS.length)];
}
