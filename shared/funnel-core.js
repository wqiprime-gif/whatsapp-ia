/**
 * Lógica compartilhada do funil de vendas — WhatsApp e Telegram.
 * Estado durável via painel /internal/lead-state (PostgreSQL).
 */
const axios = require("axios");

const BUY_INTENT =
  /pix|pagar|comprar|comprovante|pacote|b[aá]sico|chamada|completo|combo|9[,.]90|15[,.]00|20[,.]00|quanto (tenho|vc)|valor|pre[cç]o|tabela|previa|prévia|amostra|foto|fake|golpe/i;
const STALL = /^(kk+|haha|rs+|ta|t[aá]|blz|beleza|ok|okay|sei|nada|n sei|nem sei)$/i;
const CANT_PAY_RE =
  /nao consigo|n[aã]o consigo|nao tenho|n[aã]o tenho|sem dinheiro|t[aá] caro|muito caro|caro demais|nao da|n[aã]o d[aá]|imposs[ií]vel|nao posso|n[aã]o posso|so tenho|s[oó] tenho|nao pago|n[aã]o pago/i;
const DISCOUNT_INTENT_RE =
  /desconto|metade|mais barato|baratinh|diminuir|reduzir|promo[cç][aã]o|abaixar|menor pre[cç]o|faz\s+por|faz\s+menos|tem como.*desconto|n[aã]o tem como.*desconto|consegue.*desconto|da\s+um\s+desconto|com metade|pela metade|50\s*%|cinquenta por cento/i;
const COLD_MESSAGES = [
  "to aqui pra vender amor, se quer comprar me fala",
  "nao tenho tempo pra perder bb, vai comprar ou nao?",
  "se nao vai comprar tudo bem, mas para de enrolar"
];

function panelConfig() {
  return {
    url: process.env.PANEL_URL || "",
    secret: process.env.INTERNAL_SECRET || "",
    botId: process.env.BOT_ID || ""
  };
}

function chatIdFromJid(jid) {
  const raw = String(jid || "");
  if (raw.startsWith("tg:")) {
    const n = Number(raw.slice(3).replace(/\D/g, ""));
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  const bare = raw.split("@")[0] || "";
  const digits = bare.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 15) {
    const n = Number(digits);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const id = h >>> 0;
  return id > 0 ? id : 1;
}

function emptyLeadState() {
  return {
    userMessageCount: 0,
    hasSentInformacoes: false,
    hasSentAmostra: false,
    hasSentChamadaVideo: false,
    hasSentNaoSouFake: false,
    coldStrike: 0,
    paid: false,
    paidAt: null,
    selectedPackage: null,
    selectedProductName: null,
    selectedProductPriceCents: null,
    offeredHalfPrice: false,
    halfPriceProductName: null,
    followUpCount: 0,
    lastUserMessageAt: null,
    lastBotMessageAt: null,
    postSaleActive: false,
    postSaleStage: null,
    postSaleUserReplies: 0,
    sentAudioSlugs: [],
    previewSent: false,
    stateJson: {}
  };
}

async function fetchLeadState(chatId) {
  const { url, secret, botId } = panelConfig();
  if (!url || !secret || !botId || !chatId) return emptyLeadState();
  try {
    const res = await axios.get(`${url}/internal/lead-state`, {
      params: { botId, chatId },
      headers: { "x-internal": secret },
      timeout: 8000,
      validateStatus: () => true
    });
    if (res.data?.ok && res.data.state) return res.data.state;
  } catch (_) {}
  return emptyLeadState();
}

async function patchLeadState(chatId, patch, approach, approachConverted) {
  const { url, secret, botId } = panelConfig();
  if (!url || !secret || !botId || !chatId) return null;
  try {
    const res = await axios.patch(
      `${url}/internal/lead-state`,
      { botId, chatId, patch, approach, approachConverted },
      { headers: { "x-internal": secret, "content-type": "application/json" }, timeout: 8000, validateStatus: () => true }
    );
    if (res.data?.ok) return res.data.state;
  } catch (_) {}
  return null;
}

async function validateReceiptOnPanel(base64, mimetype, filename) {
  const { url, secret, botId } = panelConfig();
  if (!url || !secret) return { paid: false, reason: "painel indisponivel" };
  try {
    const res = await axios.post(
      `${url}/internal/validate-receipt`,
      { botId, base64, mimetype, filename },
      { headers: { "x-internal": secret, "content-type": "application/json" }, timeout: 60000, validateStatus: () => true }
    );
    return res.data || { paid: false, reason: "resposta invalida" };
  } catch (e) {
    return { paid: false, reason: e?.message || "erro de rede" };
  }
}

function leadShowsBuyIntent(text) {
  return BUY_INTENT.test(String(text || ""));
}

function looksLikeStalling(text, history) {
  if (leadShowsBuyIntent(text)) return false;
  const t = String(text || "").trim();
  if (/^(oi+|oii+|oie+|ol[aá]|bom dia|boa tarde|boa noite|e ai|eai|hey|hi)[\s!.?😊🙂❤️]*$/i.test(t)) {
    return false;
  }
  const userMsgs = (history || []).filter((m) => m.role === "user").length;
  if (userMsgs < 3) return false;
  if (STALL.test(t)) return true;
  if (t.length <= 3 && !/\?/.test(t)) return true;
  if (userMsgs >= 4 && !leadShowsBuyIntent(text)) {
    return !/(quero|manda|pode|sim|bora|vou|tem|quanto|oi|oii)/i.test(text);
  }
  return false;
}

function nextColdMessage(state) {
  const strike = state.coldStrike || 0;
  if (strike >= COLD_MESSAGES.length) return null;
  return COLD_MESSAGES[strike] ?? null;
}

function leadStateContext(state) {
  const parts = [
    `Mensagens do lead nesta conversa: ${state.userMessageCount || 0}.`,
    state.hasSentInformacoes
      ? "Tabela de precos JA enviada — nao use [[send_informacoes]] de novo."
      : "Tabela ainda NAO enviada.",
    state.hasSentAmostra
      ? "Previa gratis JA enviada — nao use [[send_amostra_gratis]]."
      : "Previa ainda nao enviada.",
    state.selectedPackage
      ? `Pacote escolhido pelo lead: ${state.selectedPackage}. Pode negociar desconto neste pacote.`
      : "Lead ainda NAO escolheu pacote — se pedir desconto, pergunte qual pacote quer ANTES de oferecer valor.",
    state.paid && !state.postSaleActive ? "Lead ja pagou — nao responda." : "",
    state.postSaleActive
      ? "Modo pos-venda ativo — pode conversar com carinho e pedir presente quando fizer sentido."
      : ""
  ];
  return parts.filter(Boolean).join(" ");
}

function parseOfferReais(text) {
  const m = String(text || "").match(/r?\$?\s*(\d{1,3})(?:[,.](\d{2}))?/i);
  if (!m) return null;
  const whole = Number(m[1]);
  const cents = m[2] ? Number(m[2]) : 0;
  if (Number.isNaN(whole)) return null;
  return whole + cents / 100;
}

function wantsDiscount(text) {
  const t = String(text || "");
  return CANT_PAY_RE.test(t) || DISCOUNT_INTENT_RE.test(t);
}

function pickProductForOffer(text, products) {
  const t = String(text || "").toLowerCase();
  if (!t || !products.length) return null;
  const pkgNum = t.match(/pacote\s*#?\s*(\d+)/i);
  if (pkgNum) {
    const idx = Number(pkgNum[1]) - 1;
    const sorted = [...products].sort((a, b) => (a.priceCents || 0) - (b.priceCents || 0));
    if (sorted[idx]) return sorted[idx];
  }
  if (/b[aá]sico|basico/i.test(t)) {
    const m = products.find((p) => /b[aá]sico|basico/i.test(p.name || ""));
    if (m) return m;
  }
  if (/chamada|v[ií]deo/i.test(t)) {
    const m = products.find((p) => /chamada|v[ií]deo|video/i.test(p.name || ""));
    if (m) return m;
  }
  if (/complet|combo/i.test(t)) {
    const m = products.find((p) => /complet|combo/i.test(p.name || ""));
    if (m) return m;
  }
  const offer = parseOfferReais(text);
  if (offer !== null) {
    let best = null;
    let bestDiff = Infinity;
    for (const p of products) {
      const diff = Math.abs((p.priceCents || 0) / 100 - offer);
      if (diff < 2 && diff < bestDiff) {
        best = p;
        bestDiff = diff;
      }
    }
    if (best) return best;
  }
  return null;
}

function minimumReaisForProduct(product) {
  const n = String(product?.name || "").toLowerCase();
  if (/b[aá]sico|basico/i.test(n)) return 5;
  if (/chamada|v[ií]deo|video/i.test(n)) return 10;
  if (/complet|combo/i.test(n)) return 15;
  const half = Math.round((product?.priceCents || 0) * 0.5) / 100;
  return Math.max(5, half);
}

function allActiveProducts(cfg) {
  const list = (cfg?.products || []).filter((p) => p && p.active !== false);
  if (list.length) return list;
  return [
    { name: "Pacote Básico", priceCents: 990, allowHalfPrice: true, halfPricePercent: 50 },
    { name: "Chamada Vídeo", priceCents: 1500, allowHalfPrice: true, halfPricePercent: 50 },
    { name: "Pacote Completo", priceCents: 2000, allowHalfPrice: true, halfPricePercent: 50 }
  ];
}

function askWhichPackage(products) {
  const sorted = [...products].sort((a, b) => (a.priceCents || 0) - (b.priceCents || 0));
  const list = sorted.map((p, i) => `${i + 1}) ${p.name}`).join(", ");
  return `qual pacote vc quer amor? ${list} 😊`;
}

function resolveProductForDiscount(state, text, eligible, userHistory) {
  const fromText = pickProductForOffer(text, eligible);
  if (fromText) return fromText;
  if (state.selectedProductName) {
    const match =
      eligible.find((p) => p.name === state.selectedProductName) ||
      pickProductForOffer(state.selectedProductName, eligible);
    if (match) return match;
  }
  const recent = (userHistory || [])
    .filter((m) => m.role === "user")
    .map((m) => String(m.content || ""))
    .reverse();
  for (const msg of recent) {
    const hit = pickProductForOffer(msg, eligible);
    if (hit) return hit;
  }
  return null;
}

function tryCustomAmountOffer(state, text, cfg, userHistory) {
  if (!state.hasSentInformacoes) return null;
  const amount = parseOfferReais(text);
  if (amount === null) return null;
  if (
    !/(tenho|consigo|pago|ofere|desconto|faz\s+por|por\s+\d|r\$|reais|barato|caro|metade|menos|nao tenho|n[aã]o tenho)/i.test(
      text
    )
  ) {
    return null;
  }
  const products = allActiveProducts(cfg);
  const product = resolveProductForDiscount(state, text, products, userHistory);
  if (!product) return { reply: askWhichPackage(products), approach: "ask_package" };
  const min = minimumReaisForProduct(product);
  if (amount >= min) {
    const formatted = amount.toFixed(2).replace(".", ",");
    return {
      reply: `dessa vez consigo fazer o ${product.name} por R$ ${formatted} sim, manda o pix 😘`,
      approach: "custom_amount",
      product,
      converted: true
    };
  }
  const minStr = min.toFixed(2).replace(".", ",");
  return {
    reply: `por esse valor nao da nao amor, o minimo que consigo no ${product.name} e R$ ${minStr}`,
    approach: "custom_amount",
    product,
    converted: false
  };
}

function tryHalfPriceOffer(state, text, cfg, userHistory) {
  if (state.offeredHalfPrice) return null;
  if (!wantsDiscount(text)) return null;
  if (!state.hasSentInformacoes) return null;
  if (parseOfferReais(text) !== null) return null;
  const products = allActiveProducts(cfg).filter((p) => p.allowHalfPrice !== false);
  if (!products.length) return null;
  const product = resolveProductForDiscount(state, text, products, userHistory);
  if (!product) return { reply: askWhichPackage(products), approach: "ask_package" };
  const pct = product.halfPricePercent ?? 50;
  const halfCents = Math.round((product.priceCents || 0) * (pct / 100));
  const half = (halfCents / 100).toFixed(2).replace(".", ",");
  const full = ((product.priceCents || 0) / 100).toFixed(2).replace(".", ",");
  return {
    reply: `entendo amor 💕 o ${product.name} ta R$ ${full}, mas dessa vez consigo fazer por metade — R$ ${half}. e so pra voce, manda o pix? 😘`,
    approach: "half_price",
    product,
    converted: false
  };
}

function buildPriceTableFromProducts(products) {
  const list = (products || []).filter((p) => p && p.active !== false);
  if (!list.length) return "";
  const sorted = [...list].sort((a, b) => (a.priceCents || 0) - (b.priceCents || 0));
  const lines = sorted.map((p, i) => {
    const price = ((p.priceCents || 0) / 100).toFixed(2).replace(".", ",");
    return `${i + 1}️⃣ *${p.name}* — R$ ${price}`;
  });
  return `💎 *MEUS PACOTES* 💎\n\n${lines.join("\n")}\n\nQual pacote te interessa, amor? 💕`;
}

function parsePromptActions(text) {
  const re =
    /\[\[(send_informacoes|send_chamada_video|send_amostra_gratis|send_chave_pix|naosou_fake|ignorar_lead|pedir_presente)\]\]/gi;
  const actions = [];
  let m;
  while ((m = re.exec(String(text || ""))) !== null) {
    actions.push(m[1].toLowerCase());
  }
  return [...new Set(actions)];
}

function getCompletionTools(state) {
  const tools = [
    {
      type: "function",
      function: {
        name: "send_informacoes",
        description: "Envia tabela de preços. Use quando perguntarem valores ou pacotes.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "send_chamada_video",
        description: "Envia info de chamada de vídeo.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "send_amostra_gratis",
        description: "Envia prévia/amostra grátis.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "send_chave_pix",
        description: "Envia chave Pix para pagamento.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "naosou_fake",
        description: "Quando acharem que é golpe ou fake.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "ignorar_lead",
        description: "Para de responder lead que enrolou demais.",
        parameters: { type: "object", properties: {} }
      }
    }
  ];
  return state.hasSentInformacoes
    ? tools.filter((t) => t.function.name !== "send_informacoes")
    : tools;
}

function getFollowUpConfig(cfg) {
  const steps = Array.isArray(cfg?.followUpSteps)
    ? cfg.followUpSteps.filter((s) => s && String(s.message || "").trim())
    : [];
  return {
    enabled: cfg?.followUpEnabled !== false,
    afterMs: Math.max(60000, (Number(cfg?.followUpAfterMinutes) || 10) * 60 * 1000),
    maxPerLead: steps.length > 0 ? steps.length : Math.min(5, Math.max(1, Number(cfg?.followUpMaxPerLead) || 2)),
    steps
  };
}

function localStateFromMaps(jid, maps) {
  const sel = maps.selectedProductByJid?.[jid];
  return {
    hasSentInformacoes: Boolean(maps.hasSentInformacoes?.[jid]),
    hasSentAmostra: Boolean(maps.hasSentAmostra?.[jid]),
    hasSentNaoSouFake: Boolean(maps.hasSentNaoSouFake?.[jid]),
    offeredHalfPrice: Boolean(maps.halfPriceOffered?.[jid]),
    paid: Boolean(maps.paidUsers?.[jid]),
    postSaleActive: Boolean(maps.postSaleActive?.[jid]),
    selectedProductName: sel?.name || null,
    selectedProductPriceCents: sel?.priceCents ?? null,
    previewSent: Boolean(maps.hasSentAmostra?.[jid]),
    sentAudioSlugs: Array.isArray(maps.sentAudios?.[jid]) ? maps.sentAudios[jid] : []
  };
}

function applyStateToMaps(jid, state, maps) {
  if (!state || !maps) return;
  if (maps.hasSentInformacoes) maps.hasSentInformacoes[jid] = Boolean(state.hasSentInformacoes);
  if (maps.hasSentAmostra) maps.hasSentAmostra[jid] = Boolean(state.hasSentAmostra);
  if (maps.hasSentNaoSouFake) maps.hasSentNaoSouFake[jid] = Boolean(state.hasSentNaoSouFake);
  if (maps.halfPriceOffered) maps.halfPriceOffered[jid] = Boolean(state.offeredHalfPrice);
  if (maps.paidUsers) maps.paidUsers[jid] = Boolean(state.paid);
  if (maps.postSaleActive) maps.postSaleActive[jid] = Boolean(state.postSaleActive);
  if (state.selectedProductName && maps.selectedProductByJid) {
    maps.selectedProductByJid[jid] = {
      name: state.selectedProductName,
      priceCents: state.selectedProductPriceCents || 0
    };
  }
}

module.exports = {
  chatIdFromJid,
  emptyLeadState,
  fetchLeadState,
  patchLeadState,
  validateReceiptOnPanel,
  leadShowsBuyIntent,
  looksLikeStalling,
  nextColdMessage,
  leadStateContext,
  parseOfferReais,
  wantsDiscount,
  pickProductForOffer,
  tryCustomAmountOffer,
  tryHalfPriceOffer,
  buildPriceTableFromProducts,
  parsePromptActions,
  getCompletionTools,
  getFollowUpConfig,
  allActiveProducts,
  localStateFromMaps,
  applyStateToMaps
};
