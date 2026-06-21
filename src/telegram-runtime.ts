import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import { Telegraf } from "telegraf";
import { loadBots, type BotConfig, isTelegramBot } from "./bots.js";
import { logMessage, logReceipt, logSale, setLeadSource, upsertLead, listProducts } from "./db/events.js";
import { detectSourceFromText, parseStartPayload } from "./lib/lead-source.js";
import { decryptSecret } from "./lib/crypto.js";
import { createLaranjinhaCharge } from "./lib/laranjinha.js";
import {
  audioLibraryPrompt,
  audioSlug,
  findContextualLeadAudio,
  pickAudioFromAi
} from "./lib/named-audio.js";
import {
  confirmsPriceInterest,
  isGreeting,
  limitSentences,
  wantsPixIntent,
  wantsPreviewIntent,
  wantsPriceTable
} from "./lib/bot-intents.js";
import {
  createLeadState,
  leadShowsBuyIntent,
  leadStateContext,
  looksLikeStalling,
  nextColdMessage,
  type LeadState
} from "./lib/lead-state.js";
import { giftsPromptHint, pickGiftMessage } from "./lib/gifts.js";
import {
  naosouFakeMessage,
  parsePromptActions,
  priceTableMessage,
  PROMPT_ACTION_HINT
} from "./lib/prompt-actions.js";
import {
  chamadaVideoMessage,
  detectPackageFromHistory,
  lowOfferBasicoHint,
  negotiationReply,
  parseOfferReais
} from "./lib/sales-packages.js";
import { cantPayIntent, halfPriceOfferReply } from "./lib/product-offers.js";
import { randomPreviewIntro } from "./lib/humanize.js";
import { formatReceiptOutcome, randomReceiptAck } from "./lib/receipt-messages.js";
import {
  validateReceiptFromImage,
  validateReceiptFromText,
  type ReceiptVerdict
} from "./lib/receipt-validator.js";
import { createChatCompletion } from "./lib/ai-chat.js";
import { getOpenAIModel } from "./lib/settings.js";
import {
  humanReadingPause,
  humanSendMediaList,
  humanSendNamedAudio,
  humanSendText,
  humanSendTexts
} from "./lib/telegram-send.js";
const BOT_LAUNCH_TIMEOUT_MS = 20_000;
const PREVIEW_COOLDOWN_MS = 90_000;

type RuntimeBot = {
  config: BotConfig;
  bot: Telegraf;
  historyByChat: Map<number, OpenAI.Chat.Completions.ChatCompletionMessageParam[]>;
  previewSentAt: Map<number, number>;
  previewUsed: Set<number>;
  presentationUsed: Set<number>;
  ignoredChats: Set<number>;
  leadStateByChat: Map<number, LeadState>;
  /** evita mandar o mesmo input de audio toda hora (chatId:slug -> timestamp) */
  audioCooldown: Map<string, number>;
};

function getLeadState(runtime: RuntimeBot, chatId: number) {
  let state = runtime.leadStateByChat.get(chatId);
  if (!state) {
    state = createLeadState();
    runtime.leadStateByChat.set(chatId, state);
  }
  return state;
}

function silenceChat(runtime: RuntimeBot, chatId: number) {
  runtime.ignoredChats.add(chatId);
  const state = getLeadState(runtime, chatId);
  state.paid = true;
}

const AUDIO_COOLDOWN_MS = 3 * 60 * 1000;

const runningBots = new Map<string, RuntimeBot>();

function receiptContext(config: BotConfig) {
  return {
    pixKey: config.pixKey,
    recipientName: config.pixRecipientName || config.name,
    expectedAmountCents: config.productPriceCents,
    userId: config.userId
  };
}

function isPdfFile(fileName = "", mimeType = "") {
  return mimeType === "application/pdf" || /\.pdf$/i.test(fileName);
}

function isImageFile(fileName = "", mimeType = "") {
  return mimeType.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(fileName);
}

async function downloadBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar arquivo: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}


async function analyzeReceiptPdf(input: { pdfUrl: string; config: BotConfig }): Promise<ReceiptVerdict> {
  const buffer = await downloadBuffer(input.pdfUrl);
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();
  const text = parsed.text.trim();
  if (!text) {
    return { paid: false, confidence: 0, reason: "Nao foi possivel extrair texto do PDF." };
  }
  return validateReceiptFromText({ text, ...receiptContext(input.config) });
}

async function deliverProduct(input: {
  bot: Telegraf;
  config: BotConfig;
  chatId: number;
}) {
  const { bot, config, chatId } = input;
  const telegram = bot.telegram;

  await logSale({
    botId: config.id,
    chatId,
    productName: config.productName,
    amountCents: config.productPriceCents,
    paymentMethod: config.paymentMethod
  });

  await humanSendText(telegram, chatId, config, "Pagamento confirmado amor, obrigada! 💕");
  await logMessage({
    botId: config.id,
    chatId,
    role: "system",
    content: "[venda] Pagamento confirmado — bot silenciado"
  });
}

async function handleReceiptResult(input: {
  result: ReceiptVerdict;
  chatId: number;
  bot: Telegraf;
  config: BotConfig;
  fileUrl?: string;
  fileType?: string;
}) {
  const telegram = input.bot.telegram;

  await logReceipt({
    botId: input.config.id,
    chatId: input.chatId,
    fileUrl: input.fileUrl,
    fileType: input.fileType,
    paid: input.result.paid,
    confidence: input.result.confidence,
    reason: input.result.reason
  });

  if (input.result.paid) {
    const runtime = runningBots.get(input.config.id);
    if (runtime) silenceChat(runtime, input.chatId);

    await humanSendText(
      telegram,
      input.chatId,
      input.config,
      formatReceiptOutcome(input.result, input.result.userMessage)
    );
    await deliverProduct({
      bot: input.bot,
      config: input.config,
      chatId: input.chatId
    });
    return;
  }

  await humanSendText(
    telegram,
    input.chatId,
    input.config,
    formatReceiptOutcome(input.result, input.result.userMessage)
  );
}

async function sendPaymentInstructions(bot: Telegraf, chatId: number, config: BotConfig) {
  const telegram = bot.telegram;
  const price = (config.productPriceCents / 100).toFixed(2).replace(".", ",");

  if (config.paymentMethod === "laranjinha" && config.laranjinhaApiKeyEncrypted) {
    try {
      const apiKey = decryptSecret(config.laranjinhaApiKeyEncrypted);
      const charge = await createLaranjinhaCharge({
        apiKey,
        amountCents: config.productPriceCents,
        description: config.productName
      });
      await humanSendTexts(telegram, chatId, config, [
        `Ótima escolha! ${config.productName} — R$ ${price}`,
        `Copia o Pix aqui:\n${charge.brCode}`,
        "Depois me manda o comprovante por aqui mesmo, tá?"
      ]);
      return;
    } catch (error) {
      console.error("Laranjinha:", error);
      await humanSendText(telegram, chatId, config, "Gateway indisponivel no momento. Segue a chave Pix:");
    }
  }

  await humanSendTexts(telegram, chatId, config, [
    `Chave Pix: ${config.pixKey}`,
    `Produto: ${config.productName} — R$ ${price}`,
    "Quando pagar, manda o comprovante em imagem ou PDF."
  ]);
}

async function sendPreview(runtime: RuntimeBot, chatId: number, opts?: { skipIntro?: boolean }) {
  const { bot, config, previewSentAt, previewUsed } = runtime;

  if (previewUsed.has(chatId)) {
    await humanSendText(
      bot.telegram,
      chatId,
      config,
      "ja te mostrei amor, agora so comprando que mando do jeito que voce quiser 😘"
    );
    return false;
  }

  const now = Date.now();
  const last = previewSentAt.get(chatId) ?? 0;
  if (now - last < PREVIEW_COOLDOWN_MS) return false;

  previewSentAt.set(chatId, now);
  previewUsed.add(chatId);
  if (!opts?.skipIntro) {
    await humanSendText(bot.telegram, chatId, config, randomPreviewIntro());
  }
  await humanSendMediaList(bot.telegram, chatId, config, config.previewMediaUrls);
  await humanSendText(bot.telegram, chatId, config, "Gostou amor? 😘");
  return true;
}

async function processReceiptFile(input: {
  ctx: { chat: { id: number }; telegram: Telegraf["telegram"] };
  bot: Telegraf;
  config: BotConfig;
  fileUrl: string;
  fileType: string;
  validate: () => Promise<ReceiptVerdict>;
}) {
  const chatId = input.ctx.chat.id;
  const telegram = input.ctx.telegram;

  await humanSendText(telegram, chatId, input.config, randomReceiptAck());
  await humanReadingPause(input.config);

  const result = await input.validate();
  await handleReceiptResult({
    result,
    chatId,
    bot: input.bot,
    config: input.config,
    fileUrl: input.fileUrl,
    fileType: input.fileType
  });
}

async function sendProductPresentation(runtime: RuntimeBot, chatId: number) {
  const { bot, config } = runtime;
  if (!config.productPresentationEnabled) return false;
  const urls = (config.productPresentationMediaUrls ?? []).filter(Boolean);
  if (urls.length === 0) return false;
  if (runtime.presentationUsed.has(chatId)) {
    await humanSendText(
      bot.telegram,
      chatId,
      config,
      "ja te mostrei o que voce recebe amor, agora e so comprar 😘"
    );
    return false;
  }
  runtime.presentationUsed.add(chatId);
  await humanSendText(
    bot.telegram,
    chatId,
    config,
    "Olha o que voce vai receber depois de comprar 😘"
  );
  await humanSendMediaList(bot.telegram, chatId, config, urls);
  return true;
}

async function startBot(config: BotConfig) {
  if (!config.active || !config.token || !isTelegramBot(config)) return;
  try {
    await launchBotInstance(config, config.token);
  } catch (error) {
    const backup = config.backupToken?.trim();
    if (!backup) throw error;
    console.warn(`[failover] ${config.name}: token principal falhou — ativando backup`);
    await launchBotInstance(config, backup);
  }
}

async function launchBotInstance(config: BotConfig, activeToken: string) {
  if (!config.active || !activeToken) return;

  const bot = new Telegraf(activeToken);
  const runtime: RuntimeBot = {
    config,
    bot,
    historyByChat: new Map(),
    previewSentAt: new Map(),
    previewUsed: new Set(),
    presentationUsed: new Set(),
    ignoredChats: new Set(),
    leadStateByChat: new Map(),
    audioCooldown: new Map()
  };

  function canSendAudio(chatId: number, item: import("./bots.js").NamedAudio) {
    const slug = audioSlug(item);
    const key = `${chatId}:${slug}`;
    const last = runtime.audioCooldown.get(key) ?? 0;
    if (Date.now() - last < AUDIO_COOLDOWN_MS) return false;
    runtime.audioCooldown.set(key, Date.now());
    return true;
  }

  bot.start(async (ctx) => {
    const from = ctx.from;
    const startSource = parseStartPayload(ctx.startPayload);
    await upsertLead({
      botId: config.id,
      chatId: ctx.chat.id,
      username: from?.username,
      displayName: [from?.first_name, from?.last_name].filter(Boolean).join(" "),
      source: startSource ?? undefined
    });
    if (startSource) {
      await logMessage({
        botId: config.id,
        chatId: ctx.chat.id,
        role: "system",
        content: `[origem] ${startSource} (link /start)`
      });
    }
  });

  bot.command("pix", async (ctx) => sendPaymentInstructions(bot, ctx.chat.id, config));

  bot.on("photo", async (ctx) => {
    const chatId = ctx.chat.id;
    const leadState = getLeadState(runtime, chatId);
    if (runtime.ignoredChats.has(chatId) || leadState.paid) return;

    try {
      const photos = ctx.message.photo;
      const fileUrl = await ctx.telegram.getFileLink(photos[photos.length - 1].file_id);
      await processReceiptFile({
        ctx,
        bot,
        config,
        fileUrl: fileUrl.href,
        fileType: "image",
        validate: () =>
          validateReceiptFromImage({ imageUrl: fileUrl.href, ...receiptContext(config) })
      });
    } catch (error) {
      console.error(error);
      await humanSendText(
        ctx.telegram,
        ctx.chat.id,
        config,
        "Deu um probleminha ao conferir. Tenta mandar de novo ou fala comigo."
      );
    }
  });

  bot.on("document", async (ctx) => {
    const chatId = ctx.chat.id;
    const leadState = getLeadState(runtime, chatId);
    if (runtime.ignoredChats.has(chatId) || leadState.paid) return;

    try {
      const document = ctx.message.document;
      const fileName = document.file_name || "";
      const mimeType = document.mime_type || "";
      const fileUrl = await ctx.telegram.getFileLink(document.file_id);

      if (!isPdfFile(fileName, mimeType) && !isImageFile(fileName, mimeType)) {
        await humanSendText(
          ctx.telegram,
          ctx.chat.id,
          config,
          "Para comprovante, manda imagem ou PDF, tá?"
        );
        return;
      }

      await processReceiptFile({
        ctx,
        bot,
        config,
        fileUrl: fileUrl.href,
        fileType: isPdfFile(fileName, mimeType) ? "pdf" : "image",
        validate: () =>
          isPdfFile(fileName, mimeType)
            ? analyzeReceiptPdf({ pdfUrl: fileUrl.href, config })
            : validateReceiptFromImage({ imageUrl: fileUrl.href, ...receiptContext(config) })
      });
    } catch (error) {
      console.error(error);
      await humanSendText(
        ctx.telegram,
        ctx.chat.id,
        config,
        "Deu um probleminha ao conferir. Tenta mandar de novo ou fala comigo."
      );
    }
  });

  bot.on("text", async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text;
    const from = ctx.from;
    const leadState = getLeadState(runtime, chatId);

    if (runtime.ignoredChats.has(chatId) || leadState.paid) return;

    await upsertLead({
      botId: config.id,
      chatId,
      username: from?.username,
      displayName: [from?.first_name, from?.last_name].filter(Boolean).join(" ")
    });
    await logMessage({ botId: config.id, chatId, role: "user", content: text });

    const history = runtime.historyByChat.get(chatId) || [];
    runtime.historyByChat.set(chatId, history);
    leadState.userMessageCount += 1;
    leadState.selectedPackage = detectPackageFromHistory([
      ...history,
      { role: "user", content: text }
    ]);

    if (leadState.userMessageCount === 1) {
      const textSource = detectSourceFromText(text);
      if (textSource) {
        await setLeadSource({ botId: config.id, chatId, source: textSource });
      }
    }

    const library = config.audioLibrary ?? [];

    if (/promete|depois eu pago|manda mais|só mais uma|so mais uma/i.test(text) && runtime.previewUsed.has(chatId)) {
      await humanSendText(
        ctx.telegram,
        chatId,
        config,
        "todo mundo fala que paga depois bb 😅 previa voce ja teve, agora so comprando"
      );
      return;
    }

    const offer = parseOfferReais(text);
    if (cantPayIntent(text)) {
      const products = await listProducts(config.id);
      const halfReply = halfPriceOfferReply(text, products, Boolean(leadState.offeredHalfPrice));
      if (halfReply) {
        leadState.offeredHalfPrice = true;
        await humanSendText(ctx.telegram, chatId, config, halfReply);
        history.push({ role: "user", content: text }, { role: "assistant", content: halfReply });
        return;
      }
    }

    const negReply = negotiationReply({ text, selected: leadState.selectedPackage });
    if (negReply && offer !== null) {
      await humanSendText(ctx.telegram, chatId, config, negReply);
      const hint = lowOfferBasicoHint(offer);
      if (hint && !/(basico|chamada|completo|pack)/i.test(text)) {
        await humanSendText(ctx.telegram, chatId, config, hint);
      }
      history.push({ role: "user", content: text }, { role: "assistant", content: negReply });
      return;
    }

    if (looksLikeStalling(text, history) && !leadShowsBuyIntent(text)) {
      const cold = nextColdMessage(leadState);
      if (cold) {
        leadState.coldStrike += 1;
        await humanSendText(ctx.telegram, chatId, config, cold);
        history.push({ role: "user", content: text }, { role: "assistant", content: cold });
        if (leadState.userMessageCount >= 6 && leadState.coldStrike >= 3) {
          runtime.ignoredChats.add(chatId);
        }
        return;
      }
    }

    const leadAudio = findContextualLeadAudio(text, library);
    if (leadAudio && canSendAudio(chatId, leadAudio)) {
      await humanSendNamedAudio(ctx.telegram, chatId, config, leadAudio.url);
      await logMessage({
        botId: config.id,
        chatId,
        role: "assistant",
        content: `[audio] ${leadAudio.label}`
      });
      history.push({ role: "user", content: text }, { role: "assistant", content: `[audio] ${leadAudio.label}` });
      return;
    }

    if (wantsPreviewIntent(text) && config.previewMediaUrls.length > 0) {
      const sent = await sendPreview(runtime, chatId);
      if (sent) leadState.hasSentAmostra = true;
      return;
    }

    if (wantsPixIntent(text)) {
      await sendPaymentInstructions(bot, chatId, config);
      return;
    }

    const isFirstTurn = history.filter((m) => m.role === "user").length === 0;

    try {
      const model = await getOpenAIModel(config.userId);
      const completion = await createChatCompletion(config.userId, {
        model,
        temperature: 0.75,
        messages: [
          {
            role: "system",
            content: `${config.prompt}

Pix: ${config.pixKey}. Produto padrao: ${config.productName}.
${leadStateContext(leadState)}
${PROMPT_ACTION_HINT}
${(config.giftItems?.length ?? 0) > 0 || config.giftPrompt ? giftsPromptHint(config.giftItems ?? [], config.giftPrompt ?? "") : ""}
Audios: ${audioLibraryPrompt(library)}.`
          },
          ...history.slice(-12),
          { role: "user", content: text }
        ]
      });
      const rawReply = completion.choices[0]?.message.content?.trim() || "oii amor, me chama de novo 😘";
      let { clean, actions, audioSlugs, giftSlug } = parsePromptActions(rawReply);

      if (isFirstTurn) {
        actions = actions.filter((a) => a !== "send_informacoes");
      }
      if (leadState.hasSentInformacoes) {
        actions = actions.filter((a) => a !== "send_informacoes");
      }
      if (leadState.hasSentAmostra || runtime.previewUsed.has(chatId)) {
        actions = actions.filter((a) => a !== "send_amostra_gratis");
      }
      if (runtime.presentationUsed.has(chatId)) {
        actions = actions.filter((a) => a !== "send_apresentacao_produto");
      }

      const chosenAudio = pickAudioFromAi(library, {
        audioSlugs,
        actions,
        reply: rawReply,
        userText: text
      });
      let outText = limitSentences(clean);

      if (isGreeting(text) && isFirstTurn) {
        outText = outText || "oii amor, tudo bem? 😊";
      }

      if (leadState.hasSentInformacoes && rawReply.includes("send_informacoes")) {
        outText = outText || "ja te mandei os pacotes amor, qual voce quer? 😊";
      }

      history.push({ role: "user", content: text }, { role: "assistant", content: rawReply });
      await logMessage({ botId: config.id, chatId, role: "assistant", content: rawReply });

      if (actions.includes("ignorar_lead")) {
        runtime.ignoredChats.add(chatId);
      }

      const wantsTable =
        actions.includes("send_informacoes") ||
        (wantsPriceTable(text) && (confirmsPriceInterest(text) || leadState.userMessageCount > 2));

      if (wantsTable && !leadState.hasSentInformacoes && !isFirstTurn) {
        leadState.hasSentInformacoes = true;
        await humanSendText(ctx.telegram, chatId, config, priceTableMessage());
      } else if (actions.includes("chamada_video")) {
        await humanSendText(ctx.telegram, chatId, config, chamadaVideoMessage());
      } else if (actions.includes("pedir_presente")) {
        const giftMsg = pickGiftMessage(config.giftItems ?? [], giftSlug);
        if (giftMsg) await humanSendText(ctx.telegram, chatId, config, limitSentences(giftMsg));
        else if (outText) await humanSendText(ctx.telegram, chatId, config, outText);
      } else if (chosenAudio && canSendAudio(chatId, chosenAudio)) {
        await humanSendNamedAudio(ctx.telegram, chatId, config, chosenAudio.url);
        if (actions.includes("naosou_fake")) leadState.hasSentNaoSouFake = true;
      } else if (actions.includes("naosou_fake")) {
        leadState.hasSentNaoSouFake = true;
        await humanSendText(ctx.telegram, chatId, config, naosouFakeMessage());
      } else if (outText) {
        await humanSendText(ctx.telegram, chatId, config, outText);
      }

      if (actions.includes("send_amostra_gratis") && config.previewMediaUrls.length > 0) {
        const sent = await sendPreview(runtime, chatId);
        if (sent) leadState.hasSentAmostra = true;
      }

      if (actions.includes("send_apresentacao_produto")) {
        await sendProductPresentation(runtime, chatId);
      }

      const lower = clean.toLowerCase();
      const aiOffersPreview =
        /previa|prévia|vou te mandar|segue a foto|mando agora|olha s[oó]/i.test(lower) &&
        config.previewMediaUrls.length > 0;
      if (aiOffersPreview && !actions.includes("send_amostra_gratis") && !runtime.previewUsed.has(chatId)) {
        const sent = await sendPreview(runtime, chatId, { skipIntro: true });
        if (sent) leadState.hasSentAmostra = true;
      }
    } catch (error) {
      console.error(error);
      await humanSendText(
        ctx.telegram,
        chatId,
        config,
        "IA indisponivel. Configure a API Key em Configuracoes no painel."
      );
    }
  });

  bot.catch((error) => console.error(`Erro no bot ${config.name}:`, error));

  await Promise.race([
    bot.launch(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout ao conectar no Telegram")), BOT_LAUNCH_TIMEOUT_MS)
    )
  ]);
  runningBots.set(config.id, runtime);
  console.log(`Bot ativo: ${config.name}`);
}

let restartInProgress = false;

export async function restartTelegramBots() {
  if (restartInProgress) {
    console.log("[tg] Reinicio ja em andamento, ignorando...");
    return;
  }
  restartInProgress = true;
  try {
    await Promise.all(
      [...runningBots.values()].map(async (runtime) => {
        try {
          runtime.bot.stop("restart");
        } catch {
          // ignore
        }
      })
    );
    runningBots.clear();

    for (const config of await loadBots()) {
      if (!config.active || !isTelegramBot(config)) continue;
      try {
        await startBot(config);
      } catch (error) {
        console.error(`[tg] Nao foi possivel iniciar ${config.name}:`, error);
      }
    }
  } finally {
    restartInProgress = false;
  }
}

export async function ensureTelegramBotsRunning() {
  await restartTelegramBots();
}

export async function restartSingleTelegramBot(botId: string) {
  const runtime = runningBots.get(botId);
  if (runtime) {
    try {
      runtime.bot.stop("restart");
    } catch {
      // ignore
    }
    runningBots.delete(botId);
  }
  const bot = (await loadBots()).find((b) => b.id === botId);
  if (bot?.active && isTelegramBot(bot)) {
    await startBot(bot);
  }
}

export async function shutdownTelegramBots() {
  for (const runtime of runningBots.values()) {
    try {
      runtime.bot.stop("shutdown");
    } catch {
      // ignore
    }
  }
  runningBots.clear();
}
