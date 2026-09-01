/**
 * Funil completo no Telegram — paridade com WhatsApp (negociação, tools, comprovante, follow-up).
 */
const path = require("path");
const fs = require("fs");
const funnel = require("../shared/funnel-core.js");

function createFunnelHandler(deps) {
  const {
    client,
    Api,
    loadBotConfig,
    loadPrompt,
    getConversation,
    saveConversations,
    buildSystemPrompt,
    panelLog,
    getOpenAI,
    sleep,
    sendNamedAudioVoiceOnce,
    resolveMediaLocalPath,
    pickFunnelAudios,
    parseAudioTagSlugs,
    isGreetingText,
    isFirstUserMessage,
    resolveSaudacaoAudio,
    getAudioLibrary,
    audioItemSlug,
    instancesDataDir
  } = deps;

  const leadStates = {};
  const followUpTimers = {};
  const ignoredLeads = new Set();

  async function getLeadState(chatId) {
    if (!leadStates[chatId]) {
      leadStates[chatId] = await funnel.fetchLeadState(chatId);
    }
    return leadStates[chatId];
  }

  async function saveLeadState(chatId, patch, approach, approachConverted) {
    const current = await getLeadState(chatId);
    Object.assign(current, patch);
    leadStates[chatId] = current;
    const remote = await funnel.patchLeadState(chatId, patch, approach, approachConverted);
    if (remote) leadStates[chatId] = remote;
    return leadStates[chatId];
  }

  function clearFollowUp(chatId) {
    if (followUpTimers[chatId]) {
      clearTimeout(followUpTimers[chatId]);
      delete followUpTimers[chatId];
    }
  }

  function scheduleFollowUp(chatId, peer) {
    const cfg = loadBotConfig();
    const fu = funnel.getFollowUpConfig(cfg);
    if (!fu.enabled) return;
    clearFollowUp(chatId);
    followUpTimers[chatId] = setTimeout(async () => {
      try {
        const state = await getLeadState(chatId);
        if (state.paid && !state.postSaleActive) return;
        if (state.followUpCount >= fu.maxPerLead) return;
        const step = fu.steps[state.followUpCount];
        const msg =
          (step && String(step.message || "").trim()) ||
          "oii amor, ainda quer ver meus pacotes? 😊";
        await sendText(peer, chatId, msg);
        await saveLeadState(chatId, {
          followUpCount: (state.followUpCount || 0) + 1,
          lastBotMessageAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn("follow-up TG:", e?.message || e);
      }
    }, fu.afterMs);
  }

  async function sendText(peer, chatId, text) {
    if (!text) return;
    try {
      await client.invoke(new Api.messages.SetTyping({ peer, action: new Api.SendMessageTypingAction() }));
    } catch (_) {}
    await client.sendMessage(peer, { message: text });
    void panelLog({
      type: "message",
      jid: `tg:${chatId}`,
      chatId,
      role: "assistant",
      content: text
    });
    await saveLeadState(chatId, { lastBotMessageAt: new Date().toISOString() });
    scheduleFollowUp(chatId, peer);
  }

  async function sendMedia(peer, chatId, localPath, caption) {
    await client.sendFile(peer, { file: localPath, caption: caption || "" });
    void panelLog({
      type: "message",
      jid: `tg:${chatId}`,
      chatId,
      role: "assistant",
      content: caption ? `[media] ${caption}` : "[media]"
    });
  }

  async function sendInformacoes(peer, chatId, conv, state) {
    const cfg = loadBotConfig();
    const table =
      funnel.buildPriceTableFromProducts(cfg.products) ||
      "💎 MEUS PACOTES 💎\nQual pacote te interessa, amor? 💕";
    const priceImageUrl = String(cfg.priceTableImageUrl || "").trim();
    let sent = false;
    if (priceImageUrl) {
      const local = resolveMediaLocalPath(priceImageUrl);
      if (local && fs.existsSync(local)) {
        await sendMedia(peer, chatId, local, "meus pacotes amor 😈");
        sent = true;
      }
    }
    if (!sent) await sendText(peer, chatId, table);
    conv.push({ role: "system", content: "Tabela de pacotes enviada." });
    conv.push({ role: "assistant", content: "Qual pacote te interessa, amor? 💕" });
    saveConversations();
    await saveLeadState(chatId, { hasSentInformacoes: true }, "informacoes", false);
  }

  async function sendChavePix(peer, chatId, conv) {
    const cfg = loadBotConfig();
    const pixKey = String(process.env.PIX_KEY || cfg.pixKey || "").trim();
    const pixName = String(process.env.PIX_RECIPIENT || cfg.pixRecipientName || "").trim();
    if (!pixKey) {
      await sendText(peer, chatId, "me manda um oi que ja te passo o pix amor 💕");
      return;
    }
    const msg = `chave pix: ${pixKey}${pixName ? ` (${pixName})` : ""}\nquando pagar me manda o comprovante 😘`;
    await sendText(peer, chatId, msg);
    conv.push({ role: "assistant", content: msg });
    saveConversations();
    await saveLeadState(chatId, {}, "send_pix", false);
  }

  async function sendAmostra(peer, chatId, conv, state) {
    const cfg = loadBotConfig();
    const urls = cfg.previewMediaUrls || [];
    let sent = 0;
    for (const url of urls.slice(0, 2)) {
      const local = resolveMediaLocalPath(url);
      if (local && fs.existsSync(local)) {
        await sendMedia(peer, chatId, local, "");
        sent++;
      }
    }
    if (!sent) {
      await sendText(peer, chatId, "a previa e so depois que fechar o pacote amor 😘");
    }
    await saveLeadState(chatId, { hasSentAmostra: true, previewSent: true }, "amostra", false);
    conv.push({ role: "system", content: "Prévia enviada." });
    saveConversations();
  }

  async function runTool(peer, chatId, name, conv, state) {
    switch (name) {
      case "send_informacoes":
        if (!state.hasSentInformacoes) await sendInformacoes(peer, chatId, conv, state);
        break;
      case "send_chamada_video":
        await sendText(peer, chatId, "faço chamada de vídeo sim amor 😈 manda oi que te mando os valores");
        await saveLeadState(chatId, { hasSentChamadaVideo: true });
        break;
      case "send_amostra_gratis":
        if (!state.hasSentAmostra) await sendAmostra(peer, chatId, conv, state);
        break;
      case "send_chave_pix":
        await sendChavePix(peer, chatId, conv);
        break;
      case "naosou_fake":
        await saveLeadState(chatId, { hasSentNaoSouFake: true });
        break;
      case "ignorar_lead":
        ignoredLeads.add(chatId);
        break;
      default:
        break;
    }
  }

  async function runCompletion(peer, chatId, text, conv, state) {
    if (conv.length >= 42) conv.splice(1, 1);
    conv.push({ role: "user", content: text });
    const sys = buildSystemPrompt() + "\n\n" + funnel.leadStateContext(state);
    if (conv[0]?.role === "system") conv[0].content = sys;
    else conv.unshift({ role: "system", content: sys });

    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const completion = await getOpenAI().chat.completions.create({
      model,
      temperature: 0.3,
      messages: conv.filter((m) => m.role === "system" || m.role === "user" || m.role === "assistant").slice(-24),
      max_tokens: 256,
      tools: funnel.getCompletionTools(state),
      tool_choice: "auto"
    });

    const choice = completion.choices[0];
    const toolCall = choice?.message?.tool_calls?.[0];
    const fnName = toolCall?.function?.name;

    if (fnName) {
      await runTool(peer, chatId, fnName, conv, state);
      const fresh = await getLeadState(chatId);
      return { text: "", audioSlugs: [], raw: "", tool: fnName, state: fresh };
    }

    let raw = String(choice?.message?.content || "").trim();
    const audioSlugs = parseAudioTagSlugs(raw);
    const actions = funnel.parsePromptActions(raw);
    for (const action of actions) {
      await runTool(peer, chatId, action, conv, state);
    }
    const clean = raw.replace(/\[\[.*?\]\]/g, "").trim();
    if (clean) {
      conv.push({ role: "assistant", content: raw || clean });
      saveConversations();
    }
    const fresh = await getLeadState(chatId);
    return { text: clean, audioSlugs, raw, state: fresh };
  }

  async function confirmPayment(peer, chatId, conv, approvedText) {
    const cfg = loadBotConfig();
    if (approvedText) await sendText(peer, chatId, approvedText);
    await sleep(1500);
    void panelLog({
      type: "sale",
      jid: `tg:${chatId}`,
      chatId,
      productName: cfg.productName || "VIP",
      amountCents: cfg.productPriceCents || 4990,
      paymentMethod: cfg.paymentMethod || "pix"
    });
    const deliveryUrls = cfg.deliveryMediaUrls || [];
    for (const url of deliveryUrls.slice(0, 5)) {
      const local = resolveMediaLocalPath(url);
      if (local && fs.existsSync(local)) await sendMedia(peer, chatId, local, "");
    }
    const link = String(cfg.productDeliveryLink || "").trim();
    if (link) await sendText(peer, chatId, `prontinho amor, seu acesso:\n${link}`);
    await saveLeadState(
      chatId,
      { paid: true, paidAt: new Date().toISOString(), postSaleActive: false },
      "payment_confirmed",
      true
    );
    clearFollowUp(chatId);
    conv.push({ role: "system", content: "[venda] Pagamento confirmado" });
    saveConversations();
  }

  async function handleReceipt(peer, chatId, buffer, mimetype, filename) {
    const base64 = Buffer.from(buffer).toString("base64");
    const result = await funnel.validateReceiptOnPanel(base64, mimetype, filename);
    void panelLog({
      type: "receipt",
      jid: `tg:${chatId}`,
      chatId,
      paid: Boolean(result.paid),
      confidence: Number(result.confidence || 0),
      reason: result.reason || "",
      fileType: mimetype.includes("pdf") ? "pdf" : "image"
    });
    const conv = getConversation(chatId);
    if (result.paid) {
      await confirmPayment(
        peer,
        chatId,
        conv,
        "pagamento confirmado amor 😘 ja to liberando seu acesso"
      );
      return true;
    }
    await sendText(
      peer,
      chatId,
      "amor nao consegui validar esse comprovante, manda outro print ou pdf certinho? 💕"
    );
    return true;
  }

  async function handleText(event, peer, chatId, displayName, text) {
    if (ignoredLeads.has(chatId)) return;
    clearFollowUp(chatId);

    void panelLog({
      type: "lead",
      jid: `tg:${chatId}`,
      chatId,
      displayName,
      source: "telegram"
    });
    void panelLog({
      type: "message",
      jid: `tg:${chatId}`,
      chatId,
      role: "user",
      content: text
    });

    let state = await getLeadState(chatId);
    if (state.paid && !state.postSaleActive) return;

    state = await saveLeadState(chatId, {
      userMessageCount: (state.userMessageCount || 0) + 1,
      lastUserMessageAt: new Date().toISOString()
    });

    const cfg = loadBotConfig();
    const conv = getConversation(chatId);
    const delay = Number(cfg.messageDelayMs) || 2500;
    await sleep(Math.round(delay * (0.85 + Math.random() * 0.3)));

    if (isGreetingText(text) && isFirstUserMessage(chatId)) {
      conv.push({ role: "user", content: text });
      const saudacao = resolveSaudacaoAudio();
      if (saudacao && (await sendNamedAudioVoiceOnce(peer, chatId, saudacao))) {
        conv.push({ role: "system", content: "Saudação em áudio enviada." });
        saveConversations();
        return;
      }
    }

    const negCustom = funnel.tryCustomAmountOffer(state, text, cfg, conv);
    if (negCustom?.reply) {
      if (negCustom.product) {
        await saveLeadState(
          chatId,
          {
            selectedProductName: negCustom.product.name,
            selectedProductPriceCents: negCustom.product.priceCents,
            offeredHalfPrice: negCustom.converted ? true : state.offeredHalfPrice
          },
          negCustom.approach || "custom_amount",
          Boolean(negCustom.converted)
        );
      }
      await sendText(peer, chatId, negCustom.reply);
      conv.push({ role: "assistant", content: negCustom.reply });
      saveConversations();
      return;
    }

    const negHalf = funnel.tryHalfPriceOffer(state, text, cfg, conv);
    if (negHalf?.reply) {
      if (negHalf.product) {
        await saveLeadState(
          chatId,
          {
            selectedProductName: negHalf.product.name,
            selectedProductPriceCents: negHalf.product.priceCents,
            offeredHalfPrice: true,
            halfPriceProductName: negHalf.product.name
          },
          negHalf.approach || "half_price",
          false
        );
      }
      await sendText(peer, chatId, negHalf.reply);
      conv.push({ role: "assistant", content: negHalf.reply });
      saveConversations();
      return;
    }

    if (funnel.looksLikeStalling(text, conv)) {
      const cold = funnel.nextColdMessage(state);
      if (cold) {
        await saveLeadState(chatId, { coldStrike: (state.coldStrike || 0) + 1 });
        await sendText(peer, chatId, cold);
        return;
      }
    }

    state = await getLeadState(chatId);
    const result = await runCompletion(peer, chatId, text, conv, state);
    const library = getAudioLibrary();
    const audioPicks = pickFunnelAudios({
      audioSlugs: result.audioSlugs,
      userText: text,
      library
    });

    let anyAudio = false;
    for (const item of audioPicks) {
      if (await sendNamedAudioVoiceOnce(peer, chatId, item)) anyAudio = true;
    }

    const replyText = anyAudio ? "" : result.text || "oii amor, me fala melhor o que você quer? 💕";
    if (replyText) await sendText(peer, chatId, replyText);
    else if (anyAudio) {
      void panelLog({
        type: "message",
        jid: `tg:${chatId}`,
        chatId,
        role: "assistant",
        content: `[audio:${audioPicks.map((a) => audioItemSlug(a)).join(",")}]`
      });
    }
  }

  async function handleMedia(event, peer, chatId, displayName, msg) {
    if (ignoredLeads.has(chatId)) return;
    const state = await getLeadState(chatId);
    if (state.paid && !state.postSaleActive) return;

    try {
      const buffer = await client.downloadMedia(msg, {});
      if (!buffer || !buffer.length) return;
      const mimetype = msg.media?.mimeType || msg.file?.mimeType || "image/jpeg";
      const filename = msg.file?.name || "";
      await handleReceipt(peer, chatId, buffer, mimetype, filename);
    } catch (e) {
      console.error("receipt TG:", e?.message || e);
      await sendText(peer, chatId, "manda o comprovante de novo amor, em foto ou pdf 💕");
    }
  }

  async function sendPostSale(peer, chatId, message) {
    await saveLeadState(chatId, { postSaleActive: true, postSaleStage: "reopened" });
    await sendText(peer, chatId, message);
  }

  return { handleText, handleMedia, sendPostSale, getLeadState, saveLeadState };
}

module.exports = { createFunnelHandler };
