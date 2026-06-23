import fs from "node:fs";
import path from "node:path";
import type { Telegraf } from "telegraf";
import type { BotConfig } from "../bots.js";
import { uploadsDir } from "../bots.js";
import { env } from "../config.js";
import { humanPause, polishBotText, splitReplyChunks, typingAndPause } from "./humanize.js";

let outboundHook: ((config: BotConfig, chatId: number) => void) | null = null;

export function setTelegramOutboundHook(hook: ((config: BotConfig, chatId: number) => void) | null) {
  outboundHook = hook;
}

function notifyOutbound(config: BotConfig, chatId: number) {
  if (outboundHook) outboundHook(config, chatId);
}

function isUploadedMedia(value: string) {
  return value.startsWith("/uploads/");
}

function extOf(url: string) {
  return path.extname(url.split("?")[0] || "").toLowerCase();
}

function isImageUrl(url: string) {
  const ext = extOf(url);
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(ext) || ext === "";
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm)$/i.test(extOf(url));
}

function isAudioUrl(url: string) {
  return /\.(mp3|m4a|wav)$/i.test(extOf(url));
}

function isVoiceUrl(url: string) {
  return /\.(ogg|opus)$/i.test(extOf(url));
}

async function resolveMediaSource(url: string) {
  const clean = String(url || "").trim();
  if (!clean) return null;

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }

  const baseName = path.basename(clean.split("?")[0]);
  const candidates: string[] = [];

  if (isUploadedMedia(clean)) {
    candidates.push(path.join(uploadsDir, baseName));
  }
  candidates.push(clean);

  for (const local of candidates) {
    if (local && fs.existsSync(local)) {
      return { source: local };
    }
  }

  if (isUploadedMedia(clean) && env.PUBLIC_BASE_URL) {
    try {
      const res = await fetch(`${env.PUBLIC_BASE_URL}${clean}`, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const filename = baseName || "media.jpg";
        console.log(`[tg] Midia baixada: ${env.PUBLIC_BASE_URL}${clean}`);
        return { source: buf, filename };
      }
    } catch (error) {
      console.error(`[tg] Falha ao baixar midia ${clean}:`, error);
    }
  }

  console.error(`[tg] Midia nao resolvida: ${clean} (uploadsDir=${uploadsDir})`);
  return null;
}

type TelegramApi = Telegraf["telegram"];

export async function humanSendText(
  telegram: TelegramApi,
  chatId: number,
  config: BotConfig,
  text: string
) {
  const chunks = splitReplyChunks(polishBotText(text));
  for (let i = 0; i < chunks.length; i++) {
    await typingAndPause(telegram, chatId, config.messageDelayMs, i > 0);
    await telegram.sendMessage(chatId, chunks[i]);
    notifyOutbound(config, chatId);
  }
}

export async function humanSendTexts(
  telegram: TelegramApi,
  chatId: number,
  config: BotConfig,
  messages: string[]
) {
  for (let i = 0; i < messages.length; i++) {
    const msg = polishBotText(messages[i] ?? "");
    if (!msg) continue;
    await typingAndPause(telegram, chatId, config.messageDelayMs, i > 0);
    await telegram.sendMessage(chatId, msg);
    notifyOutbound(config, chatId);
  }
}

export async function humanReadingPause(config: BotConfig) {
  const base = Math.max(config.messageDelayMs, 2000);
  const readingMs = Math.min(25000, Math.max(8000, base * 3 + Math.random() * 6000));
  await humanPause(readingMs);
}

export async function humanSendNamedAudio(
  telegram: TelegramApi,
  chatId: number,
  config: BotConfig,
  url: string
) {
  const media = await resolveMediaSource(url);
  if (!media) return false;
  await typingAndPause(telegram, chatId, config.messageDelayMs, true);
  if (isVoiceUrl(url)) await telegram.sendVoice(chatId, media);
  else if (isAudioUrl(url)) await telegram.sendAudio(chatId, media);
  else await telegram.sendDocument(chatId, media);
  notifyOutbound(config, chatId);
  return true;
}

/** Envia lista de midias. Retorna quantas foram enviadas com sucesso. */
export async function humanSendMediaList(
  telegram: TelegramApi,
  chatId: number,
  config: BotConfig,
  urls: string[]
): Promise<number> {
  let sent = 0;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const media = await resolveMediaSource(url);
    if (!media) {
      console.error(`[tg] Midia nao encontrada: ${url}`);
      continue;
    }

    await typingAndPause(telegram, chatId, config.messageDelayMs, true);

    try {
      const ext = extOf(url);
      const kind =
        /\.(jpg|jpeg|png|webp|gif)$/i.test(ext) ? "image" :
        /\.(mp4|mov|webm)$/i.test(ext) ? "video" :
        /\.(ogg|opus)$/i.test(ext) ? "voice" :
        /\.(mp3|m4a|wav)$/i.test(ext) ? "audio" :
        "unknown";

      if (kind === "image" || kind === "unknown") {
        try {
          await telegram.sendPhoto(chatId, media);
        } catch {
          await telegram.sendDocument(chatId, media);
        }
      } else if (kind === "video") await telegram.sendVideo(chatId, media);
      else if (kind === "voice") await telegram.sendVoice(chatId, media);
      else if (kind === "audio") await telegram.sendAudio(chatId, media);
      else await telegram.sendDocument(chatId, media);
      sent++;
      notifyOutbound(config, chatId);
    } catch (error) {
      console.error(`[tg] Falha ao enviar midia ${url}:`, error);
    }
  }
  return sent;
}
