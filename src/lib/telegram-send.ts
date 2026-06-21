import path from "node:path";
import type { Telegraf } from "telegraf";
import type { BotConfig } from "../bots.js";
import { uploadsDir } from "../bots.js";
import { humanPause, splitReplyChunks, typingAndPause } from "./humanize.js";

function isUploadedMedia(value: string) {
  return value.startsWith("/uploads/");
}

function mediaSource(url: string) {
  return isUploadedMedia(url) ? { source: path.join(uploadsDir, path.basename(url)) } : url;
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url);
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm)(\?.*)?$/i.test(url);
}

function isAudioUrl(url: string) {
  return /\.(mp3|m4a|wav)(\?.*)?$/i.test(url);
}

function isVoiceUrl(url: string) {
  return /\.(ogg|opus)(\?.*)?$/i.test(url);
}

type TelegramApi = Telegraf["telegram"];

export async function humanSendText(
  telegram: TelegramApi,
  chatId: number,
  config: BotConfig,
  text: string
) {
  const chunks = splitReplyChunks(text);
  for (let i = 0; i < chunks.length; i++) {
    await typingAndPause(telegram, chatId, config.messageDelayMs, i > 0);
    await telegram.sendMessage(chatId, chunks[i]);
  }
}

export async function humanSendTexts(
  telegram: TelegramApi,
  chatId: number,
  config: BotConfig,
  messages: string[]
) {
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]?.trim();
    if (!msg) continue;
    await typingAndPause(telegram, chatId, config.messageDelayMs, i > 0);
    await telegram.sendMessage(chatId, msg);
  }
}

/** Pausa longa simulando leitura de comprovante (8s–25s conforme delay do bot). */
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
  await typingAndPause(telegram, chatId, config.messageDelayMs, true);
  const media = mediaSource(url);
  if (isVoiceUrl(url)) await telegram.sendVoice(chatId, media);
  else if (isAudioUrl(url)) await telegram.sendAudio(chatId, media);
  else await telegram.sendDocument(chatId, media);
}

export async function humanSendMediaList(
  telegram: TelegramApi,
  chatId: number,
  config: BotConfig,
  urls: string[]
) {
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const media = mediaSource(url);
    await typingAndPause(telegram, chatId, config.messageDelayMs, true);

    if (isImageUrl(url)) await telegram.sendPhoto(chatId, media);
    else if (isVideoUrl(url)) await telegram.sendVideo(chatId, media);
    else if (isVoiceUrl(url)) await telegram.sendVoice(chatId, media);
    else if (isAudioUrl(url)) await telegram.sendAudio(chatId, media);
    else await telegram.sendDocument(chatId, media);
  }
}
