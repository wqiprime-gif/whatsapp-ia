const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { OpenAI } = require("openai");
const axios = require('axios');
const FormData = require('form-data');
const chalk = require('chalk');
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const qrcode = require('qrcode');
const gerarCPFValido = require('./utils/gerarcpf');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Parse command line arguments
const args = process.argv.slice(2);
let port = 4000;
let clientId = 'teste';
let modelName = 'Model';
let sessionId = 'session-default';
let proxyUrl = process.env.PROXY_URL || '';

let pmName = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port'      && i + 1 < args.length) port      = parseInt(args[i + 1]);
  if (args[i] === '--clientId'  && i + 1 < args.length) clientId  = args[i + 1];
  if (args[i] === '--modelName' && i + 1 < args.length) modelName = args[i + 1];
  if (args[i] === '--sessionId' && i + 1 < args.length) sessionId = args[i + 1];
  if (args[i] === '--pmName'    && i + 1 < args.length) pmName    = args[i + 1];
  if (args[i] === '--proxy'     && i + 1 < args.length) proxyUrl  = args[i + 1];
}

function puppeteerProxyArgs(url) {
  if (!url) return [];
  try {
    const u = new URL(url);
    const p = u.port || (u.protocol === 'https:' ? '443' : u.protocol.startsWith('socks') ? '1080' : '80');
    if (u.protocol === 'socks5:' || u.protocol === 'socks5h:') {
      const scheme = u.protocol === 'socks5h:' ? 'socks5h' : 'socks5';
      return [`--proxy-server=${scheme}://${u.hostname}:${p}`];
    }
    if (u.protocol === 'https:') {
      return [`--proxy-server=https://${u.hostname}:${p}`];
    }
    return [`--proxy-server=${u.hostname}:${p}`];
  } catch (_) {
    return [];
  }
}

function proxyAuthFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.username) return null;
    return {
      username: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password || '')
    };
  } catch (_) {
    return null;
  }
}

const proxyAuth = proxyAuthFromUrl(proxyUrl);

const filePath = path.join(__dirname, 'messages.json');
const promptsDir = path.join(__dirname, 'prompts');
const promptFilePath = path.join(promptsDir, `${sessionId}-prompt.json`);
const instancesDataDir = process.env.WA_INSTANCE_DIR || path.join(__dirname, 'instances', sessionId);
const botConfigPath = path.join(instancesDataDir, 'bot-config.json');
if (!fs.existsSync(instancesDataDir)) fs.mkdirSync(instancesDataDir, { recursive: true });
const qrFilePath = path.join(instancesDataDir, 'qr.json');
const statusFilePath = path.join(instancesDataDir, 'status.json');
const errorFilePath = path.join(instancesDataDir, 'error.txt');
let connectionState = 'starting';
let lastErrorMessage = '';

function writeConnectionStatus(state, errorMessage = '', whatsappNumber = null) {
  connectionState = state;
  if (errorMessage) lastErrorMessage = errorMessage;
  try {
    let existingNumber = cachedWhatsappNumber || null;
    if (!existingNumber && fs.existsSync(statusFilePath)) {
      try {
        const prev = JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
        existingNumber = prev.whatsappNumber?.trim() || null;
      } catch (_) {}
    }
    const numberToSave = whatsappNumber || existingNumber || null;
    if (numberToSave) cachedWhatsappNumber = numberToSave;

    const payload = {
      state,
      error: lastErrorMessage || undefined,
      updatedAt: new Date().toISOString()
    };
    if (numberToSave) payload.whatsappNumber = numberToSave;
    fs.writeFileSync(statusFilePath, JSON.stringify(payload));
    if (errorMessage) {
      fs.writeFileSync(errorFilePath, String(errorMessage));
    } else if (fs.existsSync(errorFilePath)) {
      fs.unlinkSync(errorFilePath);
    }
  } catch (_) {}
}

writeConnectionStatus('starting');

function resolveChromiumPath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable'
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        console.log(`✅ Chromium: ${candidate}`);
        return candidate;
      }
    } catch (_) {}
  }

  try {
    const fromPuppeteer = puppeteer.executablePath();
    if (fromPuppeteer && fs.existsSync(fromPuppeteer)) {
      console.log(`✅ Chromium (cache puppeteer): ${fromPuppeteer}`);
      return fromPuppeteer;
    }
    if (fromPuppeteer) {
      console.warn(`⚠️ Cache puppeteer aponta para ${fromPuppeteer} mas o arquivo não existe`);
    }
  } catch (error) {
    console.error('Chromium não encontrado via puppeteer:', error.message);
  }

  console.error('❌ Nenhum Chromium encontrado. Instale chromium no servidor ou defina PUPPETEER_EXECUTABLE_PATH.');
  return undefined;
}

async function panelLog(payload) {
  const panelUrl = process.env.PANEL_URL;
  const secret = process.env.INTERNAL_SECRET;
  const botId = process.env.BOT_ID || sessionId;
  if (!panelUrl || !secret) return;
  try {
    await axios.post(`${panelUrl}/internal/events`, { ...payload, botId }, {
      headers: { 'x-internal': secret, 'Content-Type': 'application/json' },
      timeout: 5000
    });
  } catch (_) {}
}

function waChatId(jid) {
  const digits = String(jid).replace(/@.*/, '').replace(/\D/g, '');
  return Number(digits) || 0;
}

const RECEIPT_ACK_MESSAGES = [
  'Recebi! Deixa eu conferir aqui rapidinho...',
  'Chegou sim, amor. Vou olhar o comprovante agora.',
  'Perfeito, já tô verificando pra você.',
  'Obrigada por mandar! Só um instante que eu confiro.'
];

const RECEIPT_APPROVED_MESSAGES = [
  'Tudo certinho! Já liberei seu acesso pra você.',
  'Pagamento confirmado! Pode entrar que já tá liberado.',
  'Deu certo, amor! Segue seu acesso.'
];

function randomReceiptAck() {
  return RECEIPT_ACK_MESSAGES[Math.floor(Math.random() * RECEIPT_ACK_MESSAGES.length)];
}

function randomReceiptApproved() {
  return RECEIPT_APPROVED_MESSAGES[Math.floor(Math.random() * RECEIPT_APPROVED_MESSAGES.length)];
}

async function validarComprovanteNoPainel(base64Data, mimetype, filename) {
  const panelUrl = process.env.PANEL_URL;
  const secret = process.env.INTERNAL_SECRET;
  const botId = process.env.BOT_ID || sessionId;
  if (!panelUrl || !secret) {
    throw new Error('Painel indisponivel para validar comprovante');
  }
  const res = await axios.post(
    `${panelUrl}/internal/validate-receipt`,
    { botId, base64: base64Data, mimetype, filename },
    {
      headers: { 'x-internal': secret, 'Content-Type': 'application/json' },
      timeout: 120000
    }
  );
  return res.data;
}

async function sendDeliveryMedia(client, messageFrom) {
  const config = loadBotConfig();
  const deliveryUrls = (config.deliveryMediaUrls || []).filter(Boolean);
  if (deliveryUrls.length === 0) return 0;

  let sentCount = 0;
  for (const url of deliveryUrls) {
    const localPath = await resolveMediaLocalPath(url);
    if (!localPath) {
      console.error(`❌ Entrega não encontrada: ${url}`);
      continue;
    }
    const media = MessageMedia.fromFilePath(localPath);
    if (!media) continue;
    await client.sendMessage(messageFrom, media);
    sentCount++;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return sentCount;
}

// Audio files with absolute paths
const audioFiles = {
  saudacao: path.join(__dirname, 'saudacao.mp3'),
  informacoes: path.join(__dirname, 'informacoes.mp3'),
  chavepix: path.join(__dirname, 'chavepix.mp3'),
  qualpack: path.join(__dirname, 'qualpack.mp3'),
  chamadavideo: path.join(__dirname, 'chamadavideo.mp3'),
  naosoufake: path.join(__dirname, 'naosoufake.mp3'),
  precos: path.join(__dirname, 'precos.jpg'),
  amostra: path.join(__dirname, 'amostra.jpg')  // Nota: é .jpg, não .jpeg
};

// Validate audio files exist
console.log('🔊 Verificando arquivos de áudio...');
for (const [name, filePath] of Object.entries(audioFiles)) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${name}: ${filePath}`);
  } else {
    console.warn(`⚠️ FALTANDO: ${name} - ${filePath}`);
  }
}

// Criar diretório de prompts se não existir
if (!fs.existsSync(promptsDir)) {
  fs.mkdirSync(promptsDir, { recursive: true });
}

// Configuração de pacotes por instância (pacotes.json opcional)
let pacotesConfig = null;
const pacotesConfigPath = path.join(__dirname, 'pacotes.json');
if (fs.existsSync(pacotesConfigPath)) {
  try {
    pacotesConfig = JSON.parse(fs.readFileSync(pacotesConfigPath, 'utf8'));
    console.log('📦 pacotes.json carregado:', pacotesConfigPath);
  } catch (e) {
    console.warn('⚠️ Erro ao carregar pacotes.json:', e.message);
  }
}

// Caminho do prompt padrão (fallback só se o painel não tiver prompt salvo)
const defaultPromptPath = path.join(__dirname, 'SYSTEM_PROMPT.md');
let customPrompt = '';
let promptFileMtime = 0;

// Carregar prompt padrão do arquivo SYSTEM_PROMPT.md
function loadDefaultPrompt() {
  try {
    if (fs.existsSync(defaultPromptPath)) {
      const data = fs.readFileSync(defaultPromptPath, 'utf8');
      console.log('✅ Prompt padrão carregado de SYSTEM_PROMPT.md');
      return data;
    }
  } catch (error) {
    console.error('Erro ao carregar prompt padrão:', error.message);
  }
  return null;
}

function loadBotConfig() {
  try {
    if (fs.existsSync(botConfigPath)) {
      return JSON.parse(fs.readFileSync(botConfigPath, 'utf8'));
    }
  } catch (error) {
    console.warn('⚠️ Erro ao carregar bot-config.json:', error.message);
  }
  return { previewMediaUrls: [], deliveryMediaUrls: [], pixKey: '', pixRecipientName: '', productName: 'VIP', productPriceCents: 4990, productDeliveryLink: '', messageDelayMs: 4000, followUpEnabled: true, followUpAfterMinutes: 10, followUpMaxPerLead: 2, products: [] };
}

const halfPriceOffered = {};

const CANT_PAY_RE =
  /nao consigo|n[aã]o consigo|nao tenho|n[aã]o tenho|sem dinheiro|t[aá] caro|muito caro|caro demais|nao da|n[aã]o d[aá]|imposs[ií]vel|nao posso|n[aã]o posso|so tenho|s[oó] tenho|nao pago|n[aã]o pago/i;

function parseOfferReais(text) {
  const m = String(text || '').match(/r?\$?\s*(\d{1,3})(?:[,.](\d{2}))?/i);
  if (!m) return null;
  const whole = Number(m[1]);
  const cents = m[2] ? Number(m[2]) : 0;
  if (Number.isNaN(whole)) return null;
  return whole + cents / 100;
}

function tryHalfPriceOffer(jid, text) {
  if (halfPriceOffered[jid]) return null;
  if (!CANT_PAY_RE.test(String(text || ''))) return null;
  const products = (loadBotConfig().products || []).filter((p) => p && p.allowHalfPrice !== false);
  if (products.length === 0) return null;

  const offer = parseOfferReais(text);
  let product = products.find((p) => p.allowHalfPrice) || products[0];
  if (offer !== null) {
    const match = products.find((p) => Math.abs((p.priceCents || 0) / 100 - offer) < 2);
    if (match) product = match;
  }

  const pct = product.halfPricePercent ?? 50;
  const halfCents = Math.round((product.priceCents || 0) * (pct / 100));
  const half = (halfCents / 100).toFixed(2).replace('.', ',');
  const full = ((product.priceCents || 0) / 100).toFixed(2).replace('.', ',');
  halfPriceOffered[jid] = true;
  return `entendo amor 💕 o ${product.name} ta R$ ${full}, mas dessa vez consigo fazer por metade — R$ ${half}. e so pra voce, manda o pix? 😘`;
}

/** Pausa entre mensagens / antes de responder — vem do painel (messageDelayMs). */
function getMessageDelayMs() {
  const cfg = loadBotConfig();
  const base = Number(cfg.messageDelayMs);
  const ms = Number.isFinite(base) && base >= 500 ? base : 4000;
  const jitter = 0.88 + Math.random() * 0.24;
  return Math.round(ms * jitter);
}

function getFollowUpConfig() {
  const cfg = loadBotConfig();
  return {
    enabled: cfg.followUpEnabled !== false,
    afterMs: Math.max(60000, (Number(cfg.followUpAfterMinutes) || 10) * 60 * 1000),
    maxPerLead: Math.min(5, Math.max(1, Number(cfg.followUpMaxPerLead) || 2))
  };
}

const followUpTimers = {};
const followUpCounts = {};
const lastUserActivityAt = {};
const lastBotMessageAt = {};

function clearFollowUpTimer(jid) {
  if (followUpTimers[jid]) {
    clearTimeout(followUpTimers[jid]);
    followUpTimers[jid] = null;
  }
}

function onLeadMessage(jid) {
  lastUserActivityAt[jid] = Date.now();
  clearFollowUpTimer(jid);
  followUpCounts[jid] = 0;
}

function onBotOutbound(jid) {
  lastBotMessageAt[jid] = Date.now();
  scheduleFollowUp(jid);
}

function scheduleFollowUp(jid) {
  clearFollowUpTimer(jid);
  const { enabled, afterMs, maxPerLead } = getFollowUpConfig();
  if (!enabled) return;
  if (comprovantesRecebidos[jid] || paidUsers[jid]) return;
  if ((followUpCounts[jid] || 0) >= maxPerLead) return;

  const scheduledAt = Date.now();
  followUpTimers[jid] = setTimeout(async () => {
    followUpTimers[jid] = null;
    if (comprovantesRecebidos[jid] || paidUsers[jid]) return;
    if ((lastUserActivityAt[jid] || 0) > (lastBotMessageAt[jid] || scheduledAt)) return;
    if ((followUpCounts[jid] || 0) >= maxPerLead) return;

    const msg = await generatePersonaReply(
      jid,
      'O lead ficou quieto sem responder depois da sua última mensagem. Mande UMA frase curta e carinhosa para puxar conversa (tipo "oii amor, esqueceu de mim?" ou "me deixou no vácuo né kkk"). Varie — não copie frase de atendente.'
    );
    if (!msg) return;

    followUpCounts[jid] = (followUpCounts[jid] || 0) + 1;
    await sendTextHuman(client, jid, msg);
    void panelLog({ type: 'message', jid, role: 'assistant', content: msg });
    onBotOutbound(jid);
  }, afterMs);
}

async function typingForMs(chat, durationMs) {
  const end = Date.now() + durationMs;
  while (Date.now() < end) {
    try {
      if (chat) await chat.sendStateTyping();
    } catch (_) {}
    const left = end - Date.now();
    if (left <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(3500, left)));
  }
}

const previewSentPath = path.join(instancesDataDir, 'preview-sent.json');

function loadPreviewSentStore() {
  try {
    if (fs.existsSync(previewSentPath)) {
      const data = JSON.parse(fs.readFileSync(previewSentPath, 'utf8'));
      return data && typeof data === 'object' ? data : {};
    }
  } catch (error) {
    console.warn('⚠️ Erro ao carregar preview-sent.json:', error.message);
  }
  return {};
}

function hasPreviewBeenSent(jid) {
  return Boolean(hasSentAmostra[jid]);
}

function markPreviewSent(jid) {
  hasSentAmostra[jid] = true;
  try {
    const store = loadPreviewSentStore();
    store[jid] = new Date().toISOString();
    fs.writeFileSync(previewSentPath, JSON.stringify(store, null, 2));
  } catch (error) {
    console.warn('⚠️ Erro ao salvar preview-sent.json:', error.message);
  }
}

function hydratePreviewSentFromDisk() {
  const store = loadPreviewSentStore();
  for (const jid of Object.keys(store)) {
    hasSentAmostra[jid] = true;
  }
  if (Object.keys(store).length > 0) {
    console.log(`📎 Prévias já enviadas (persistidas): ${Object.keys(store).length} contato(s)`);
  }
}

async function resolveMediaLocalPath(url) {
  const clean = String(url || '').trim();
  if (!clean) return null;
  if (fs.existsSync(clean)) return clean;

  const baseName = path.basename(clean.split('?')[0]);
  const uploadsDir = process.env.UPLOADS_DIR;

  if (uploadsDir && clean.startsWith('/uploads/')) {
    const local = path.join(uploadsDir, baseName);
    if (fs.existsSync(local)) return local;
  }

  const panelUrl = process.env.PANEL_URL;
  if (panelUrl && clean.startsWith('/')) {
    try {
      const res = await axios.get(`${panelUrl}${clean}`, { responseType: 'arraybuffer', timeout: 30000 });
      const cacheDir = path.join(instancesDataDir, 'media-cache');
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      const cached = path.join(cacheDir, baseName);
      fs.writeFileSync(cached, res.data);
      return cached;
    } catch (error) {
      console.error(`❌ Falha ao baixar mídia do painel (${clean}):`, error.message);
    }
  }

  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const res = await axios.get(clean, { responseType: 'arraybuffer', timeout: 30000 });
      const cacheDir = path.join(instancesDataDir, 'media-cache');
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      const cached = path.join(cacheDir, baseName || `remote-${Date.now()}`);
      fs.writeFileSync(cached, res.data);
      return cached;
    } catch (error) {
      console.error(`❌ Falha ao baixar mídia (${clean}):`, error.message);
    }
  }

  return null;
}

function getPixConfig() {
  const config = loadBotConfig();
  return {
    pixKey: String(process.env.PIX_KEY || config.pixKey || pacotesConfig?.pixKey || '').trim(),
    pixRecipientName: String(
      process.env.PIX_RECIPIENT || config.pixRecipientName || pacotesConfig?.nome_destinatario || modelName || ''
    ).trim()
  };
}

function readPanelPromptRaw() {
  try {
    if (fs.existsSync(promptFilePath)) {
      const parsed = JSON.parse(fs.readFileSync(promptFilePath, 'utf8'));
      const text = String(parsed.prompt || '').trim();
      if (text) return text;
    }
  } catch (error) {
    console.error('Erro ao ler prompt do painel:', error.message);
  }
  return '';
}

function buildPixAppendix() {
  const { pixKey, pixRecipientName } = getPixConfig();
  if (!pixKey) {
    return '\n\n[PIX NÃO CONFIGURADO — configure a chave Pix no painel da instância.]';
  }
  let block = `\n\n--- DADOS REAIS DO PAINEL (OBRIGATÓRIO) ---\nChave PIX: ${pixKey}\n`;
  if (pixRecipientName) block += `Nome do recebedor: ${pixRecipientName}\n`;
  block += 'Quando o lead quiser pagar, use EXATAMENTE a chave acima ou a tag [[send_chave_pix]].\n';
  block += 'NUNCA escreva [sua_chave_pix], {chave_pix} ou "chave do painel".\n';
  return block;
}

function buildSystemPrompt() {
  const panelPrompt = readPanelPromptRaw();
  const base = panelPrompt || loadDefaultPrompt() || '';
  return base + buildPixAppendix();
}

function refreshAllConversationPrompts() {
  const systemPrompt = buildSystemPrompt();
  for (const key of Object.keys(userConversations)) {
    if (userConversations[key]?.[0]?.role === 'system') {
      userConversations[key][0].content = systemPrompt;
    }
  }
}

function reloadPromptFromDisk(forceReset = false) {
  try {
    if (fs.existsSync(promptFilePath)) {
      const stat = fs.statSync(promptFilePath);
      if (!forceReset && stat.mtimeMs === promptFileMtime) return false;
      promptFileMtime = stat.mtimeMs;
    }
  } catch (_) {}
  customPrompt = buildSystemPrompt();
  const raw = readPanelPromptRaw();
  const source = raw ? `painel (${sessionId})` : 'SYSTEM_PROMPT.md (sem prompt no painel)';
  console.log(`✅ Prompt carregado de ${source} — ${customPrompt.length} caracteres`);
  if (forceReset || raw) refreshAllConversationPrompts();
  return true;
}

function loadCustomPrompt() {
  reloadPromptFromDisk(true);
  return customPrompt;
}

function saveCustomPrompt(prompt) {
  try {
    fs.writeFileSync(promptFilePath, JSON.stringify({ prompt }, null, 2));
    reloadPromptFromDisk(true);
    console.log('✅ Prompt customizado salvo.');
    return true;
  } catch (error) {
    console.error('Erro ao salvar prompt customizado:', error.message);
    return false;
  }
}

puppeteer.use(StealthPlugin());

// Session Manager para persistência
const sessionManager = require('./session-manager');
const puppeteerArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--disable-web-security',
  '--no-first-run',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-sync',
  '--disable-translate',
  '--mute-audio',
  '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required',
  ...puppeteerProxyArgs(proxyUrl),
];

if (proxyUrl) {
  console.log(`🔒 Proxy isolado ativo para sessão ${sessionId}`);
}

const authDataPath = process.env.WA_AUTH_DIR || path.join(__dirname, '.wwebjs_auth');
if (!fs.existsSync(authDataPath)) fs.mkdirSync(authDataPath, { recursive: true });

function hasPersistedWaSession() {
  const sessionDir = path.join(authDataPath, `session-${clientId}`);
  if (!fs.existsSync(sessionDir)) return false;
  return (
    fs.existsSync(path.join(sessionDir, 'Default')) ||
    fs.readdirSync(sessionDir).some((name) => name && name !== 'DevToolsActivePort')
  );
}

function purgeSessionDir() {
  const sessionDir = path.join(authDataPath, `session-${clientId}`);
  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log(`🗑️ Sessão removida: ${sessionDir}`);
    }
  } catch (e) {
    console.warn('⚠️ Falha ao apagar sessão:', e?.message || e);
  }
}

if (process.env.WA_FORCE_QR === '1') {
  console.log('🔄 WA_FORCE_QR ativo — sessão antiga será ignorada; aguardando QR novo');
  purgeSessionDir();
}

console.log(`🔐 Auth: ${authDataPath} · clientId=${clientId} · sessão salva=${hasPersistedWaSession() ? 'sim' : 'não'}`);

const chromiumPath = resolveChromiumPath();
const client = new Client({
  authStrategy: new LocalAuth({ clientId: clientId, dataPath: authDataPath }),
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
  },
  puppeteer: {
    ...(chromiumPath ? { executablePath: chromiumPath } : {}),
    headless: true,
    args: puppeteerArgs,
  },
});

if (proxyAuth) {
  client.on('qr', async () => {
    try {
      const browser = client.pupBrowser;
      if (!browser) return;
      const pages = await browser.pages();
      const page = pages[0];
      if (page) await page.authenticate(proxyAuth);
    } catch (_) {}
  });
}

client.initialize().catch((error) => {
  const message = error?.message || String(error);
  console.error('❌ Falha ao inicializar WhatsApp Web:', message);
  writeConnectionStatus('error', message);
});

const openAiApiKey = process.env.OPENAI_API_KEY;
const aiRuntimePath = path.join(instancesDataDir, 'ai-runtime.json');
let _aiKey = openAiApiKey || '';
let _aiModel = process.env.AI_MODEL || 'gpt-4o-mini';
let _aiProvider = process.env.AI_PROVIDER || 'openai';
let _aiBaseUrl = process.env.AI_BASE_URL || '';
let _openaiClient = null;
let _aiSig = '';

function reloadAiRuntime() {
  const envKey = String(process.env.OPENAI_API_KEY || '').trim();
  try {
    if (fs.existsSync(aiRuntimePath)) {
      const d = JSON.parse(fs.readFileSync(aiRuntimePath, 'utf8'));
      const fileKey = String(d.apiKey || '').trim();
      if (fileKey) _aiKey = fileKey;
      else if (envKey) _aiKey = envKey;
      if (d.model) _aiModel = d.model;
      if (d.provider) _aiProvider = d.provider;
      if (d.baseURL !== undefined) _aiBaseUrl = d.baseURL || '';
    } else if (envKey) {
      _aiKey = envKey;
    }
  } catch (e) {
    console.warn('⚠️ ai-runtime.json:', e.message);
    if (envKey) _aiKey = envKey;
  }
}

function aiModel() {
  reloadAiRuntime();
  return _aiModel || 'gpt-4o-mini';
}

function getOpenAiApiKey() {
  reloadAiRuntime();
  return _aiKey || '';
}

function getOpenAI() {
  reloadAiRuntime();
  const sig = `${_aiKey}|${_aiModel}|${_aiProvider}|${_aiBaseUrl}`;
  if (!_openaiClient || sig !== _aiSig) {
    _aiSig = sig;
    if (!_aiKey) {
      console.error('❌ OPENAI_API_KEY vazia — salve a API Key na instância (não precisa reconectar o WhatsApp).');
    } else {
      console.log(`🤖 IA ativa: ${_aiProvider} · ${aiModel()} · key ${_aiKey.slice(0, 7)}…`);
    }
    const opts = { apiKey: _aiKey || 'missing-key', timeout: 90_000, maxRetries: 2 };
    if (_aiBaseUrl) {
      opts.baseURL = _aiBaseUrl;
      if (_aiProvider === 'openrouter') {
        opts.defaultHeaders = {
          'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://zapmanager.app',
          'X-Title': 'ZapManager'
        };
      }
    }
    _openaiClient = new OpenAI(opts);
  }
  return _openaiClient;
}

getOpenAI();
console.log(`🔑 IA runtime: ${aiRuntimePath} · key=${getOpenAiApiKey() ? getOpenAiApiKey().slice(0, 7) + '…' : 'VAZIA'}`);

/** Gera fala no tom do prompt da instância — sem mensagens fixas do código. */
async function generatePersonaReply(userNumber, instruction) {
  const conversation = getUserConversation(userNumber);
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: aiModel(),
      temperature: 0.55,
      max_tokens: 120,
      messages: [
        ...conversation.slice(0, 40),
        {
          role: 'system',
          content: `${instruction}\n\nResponda SOMENTE a mensagem para o lead (máx 2 frases curtas), no tom exato da sua persona. Sem aspas. Sem explicações.`
        }
      ]
    });
    const text = String(completion.choices[0]?.message?.content || '').trim();
    if (!text) return '';
    conversation.push({ role: 'assistant', content: text });
    return text;
  } catch (error) {
    console.error('generatePersonaReply:', error.message);
    return '';
  }
}

const MAX_TOKENS = 256;
const userConversations = {};
const conversationsStorePath = path.join(instancesDataDir, 'conversations-store.json');
let conversationsSaveTimer = null;

function loadConversationsStore() {
  try {
    if (!fs.existsSync(conversationsStorePath)) return;
    const data = JSON.parse(fs.readFileSync(conversationsStorePath, 'utf8'));
    if (data.conversations && typeof data.conversations === 'object') {
      Object.assign(userConversations, data.conversations);
    }
    if (data.halfPriceOffered) Object.assign(halfPriceOffered, data.halfPriceOffered);
    if (data.hasSentInformacoes) Object.assign(hasSentInformacoes, data.hasSentInformacoes);
    if (data.hasSentNaoSouFake) Object.assign(hasSentNaoSouFake, data.hasSentNaoSouFake);
    console.log(`💾 Memória: ${Object.keys(userConversations).length} conversa(s) restaurada(s)`);
  } catch (error) {
    console.warn('⚠️ Erro ao carregar memória de conversas:', error.message);
  }
}

function scheduleSaveConversations() {
  if (conversationsSaveTimer) clearTimeout(conversationsSaveTimer);
  conversationsSaveTimer = setTimeout(() => {
    try {
      const trimmed = {};
      for (const [jid, conv] of Object.entries(userConversations)) {
        if (!Array.isArray(conv)) continue;
        const system = conv[0]?.role === 'system' ? [conv[0]] : [];
        const rest = conv.filter((m, i) => i === 0 && m.role === 'system' ? false : true).slice(-36);
        trimmed[jid] = [...system, ...rest];
      }
      fs.writeFileSync(conversationsStorePath, JSON.stringify({
        conversations: trimmed,
        halfPriceOffered,
        hasSentInformacoes,
        hasSentNaoSouFake,
        updatedAt: new Date().toISOString()
      }, null, 0));
    } catch (error) {
      console.warn('⚠️ Erro ao salvar memória:', error.message);
    }
  }, 600);
}

const hasSentInformacoes = {};
const hasSentAmostra = {};
const hasSentNaoSouFake = {};
hydratePreviewSentFromDisk();
const arrayImport = require('./arrayImport');
const messageBuffers = {};
const bufferTimers = {};
let isProcessing = {};
const audioFailures = {};
const comprovantesRecebidos = {}; // Tracks which users have sent proof of payment
const paidUsers = {}; // Users who have already paid

loadCustomPrompt();
loadConversationsStore();

function getUserConversation(userNumber) {
  reloadPromptFromDisk(false);
  if (!userConversations[userNumber]) {
    const systemPrompt = buildSystemPrompt() || JSON.stringify(arrayImport);
    userConversations[userNumber] = [
      { role: "system", content: systemPrompt }
    ];
    hasSentInformacoes[userNumber] = false;
    hasSentAmostra[userNumber] = Boolean(loadPreviewSentStore()[userNumber]);
    hasSentNaoSouFake[userNumber] = false;
  }
  return userConversations[userNumber];
}

const PROMPT_ACTION_RE =
  /\[\[(send_informacoes|send_amostra_gratis|send_chave_pix|naosou_fake|ignorar_lead|chamada_video|pedir_presente)\]\]/gi;

function parsePromptActions(text) {
  const actions = [];
  let clean = String(text || '')
    .replace(PROMPT_ACTION_RE, (_, tag) => {
      actions.push(tag.toLowerCase());
      return '';
    })
    .replace(/\[\[audio:([a-z0-9_]+)\]\]|\[\[audio_([a-z0-9_]+)\]\]/gi, '')
    .trim();
  return { clean, actions: [...new Set(actions)] };
}

function wantsPreviewIntent(text) {
  const t = String(text || '').toLowerCase();
  return /pr[eé]via|amostra|teste gr[aá]tis|manda(r)?\s+(uma\s+)?foto|tem foto|me manda|manda\s+manda|manda\s+a[ií]|cad[eê]\s+(a\s+)?(previa|prévia|foto|amostra)|quer(o)?\s+ver|uma\s+foto\s+sua|foto\s+sua|previa\s+sua|prévia\s+sua|manda\s+pra\s+mim|tem\s+como\s+mandar/i.test(
    t
  );
}

function hasPreviewMedia() {
  return (loadBotConfig().previewMediaUrls || []).filter(Boolean).length > 0;
}

function conversationWantsPreview(userNumber) {
  const conv = userConversations[userNumber] || [];
  const users = conv
    .filter((m) => m.role === 'user')
    .slice(-5)
    .map((m) => m.content)
    .join(' ');
  const assistants = conv
    .filter((m) => m.role === 'assistant')
    .slice(-3)
    .map((m) => m.content)
    .join(' ');
  return wantsPreviewIntent(users) || /pr[eé]via|amostra|mandar uma|vou te mandar/i.test(assistants);
}

function aiFakesPreviewSend(clean) {
  return /aqui est[aá]|mandei|te mandei|olha a[ií]|segue (a|sua)|vou te mandar.*pr[eé]via|prévia bem gostosa|espero que goste/i.test(
    String(clean || '')
  );
}

function shouldAutoSendPreview(userNumber, combinedMessage, aiClean, actions) {
  if (hasPreviewBeenSent(userNumber) || !hasPreviewMedia()) return false;
  if (actions.includes('send_amostra_gratis')) return true;
  if (wantsPreviewIntent(combinedMessage)) return true;
  if (conversationWantsPreview(userNumber)) return true;
  if (aiFakesPreviewSend(aiClean)) return true;
  return false;
}

function wantsPixIntent(text) {
  return /chave\s*pix|pix\s*key|manda(r)?\s+(a\s+)?(pix|chave)|qual\s+(a\s+)?chave|n[aã]o\s+(me\s+)?mandou.*(pix|chave)|cad[eê]\s+(a\s+)?(pix|chave)|voce\s+n[aã]o\s+mandou/i.test(
    String(text || '')
  );
}

function sanitizePixPlaceholders(text) {
  const { pixKey } = getPixConfig();
  if (!pixKey || !text) return text;
  return String(text)
    .replace(/\[(sua[_\s-]?chave[_\s-]?pix|chave[_\s-]?pix|pix[_\s-]?key)\]/gi, pixKey)
    .replace(/\{(sua[_\s-]?chave[_\s-]?pix|chave[_\s-]?pix|pix[_\s-]?key)\}/gi, pixKey);
}

function responseContainsPixKey(text) {
  const { pixKey } = getPixConfig();
  if (!pixKey || !text) return false;
  if (String(text).includes(pixKey)) return true;
  const digits = pixKey.replace(/\D/g, '');
  return digits.length >= 8 && String(text).replace(/\D/g, '').includes(digits);
}

async function executePromptActions(client, messageFrom, actions) {
  const conversation = getUserConversation(messageFrom);
  for (const action of actions) {
    if (action === 'send_amostra_gratis' && !hasPreviewBeenSent(messageFrom)) {
      const ok = await functionCalls.send_amostra_gratis(client, messageFrom, conversation);
      if (ok) markPreviewSent(messageFrom);
    } else if (action === 'send_informacoes' && !hasSentInformacoes[messageFrom]) {
      hasSentInformacoes[messageFrom] = true;
      await functionCalls.send_informacoes(client, messageFrom, conversation);
    } else if (action === 'naosou_fake' && !hasSentNaoSouFake[messageFrom]) {
      hasSentNaoSouFake[messageFrom] = true;
      await functionCalls.naosou_fake(client, messageFrom, conversation);
    } else if (action === 'chamada_video') {
      await functionCalls.chamada_video(client, messageFrom, conversation);
    } else if (action === 'send_chave_pix') {
      await functionCalls.send_chave_pix(client, messageFrom, conversation);
    } else if (action === 'ignorar_lead') {
      await functionCalls.ignorar_lead(client, messageFrom, conversation);
    }
  }
}

async function runCompletion(userNumber, message) {
  const conversation = getUserConversation(userNumber);
  if (conversation.length >= 42) {
    conversation.splice(1, 1);
  }
  conversation.push({ role: "user", content: message });
  scheduleSaveConversations();

  if (!hasPreviewBeenSent(userNumber) && hasPreviewMedia() && (wantsPreviewIntent(message) || conversationWantsPreview(userNumber))) {
    conversation.push({
      role: 'system',
      content: 'O lead quer prévia/amostra. OBRIGATÓRIO: chame send_amostra_gratis agora. Proibido dizer "aqui está" ou "mandei" sem enviar a mídia pela função.'
    });
  }

  try {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'send_informacoes',
          description: 'Envia a tabela de preços com os 3 pacotes disponíveis. Use quando o lead perguntar sobre valores, preços, pacotes ou o que você tem.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'send_amostra_gratis',
          description: 'Envia uma foto de amostra gratuita para o lead. Use quando pedirem prévia, foto, amostra ou teste grátis.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'send_chave_pix',
          description: 'Envia a chave Pix real configurada no painel. Use quando o lead quiser comprar, pedir a chave Pix, ou confirmar que vai pagar.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'chamada_video',
          description: 'Informa sobre a chamada de vídeo de 5 minutos e seus valores.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'naosou_fake',
          description: 'Usa quando o lead achar que é golpe, fake ou questionar se é você na foto.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'ignorar_lead',
          description: 'Para de responder permanentemente quando o lead enrolou demais (6+ mensagens sem intenção de compra), foi rude ou abusivo.',
          parameters: { type: 'object', properties: {} },
        },
      },
    ];

    const availableTools = hasSentInformacoes[userNumber]
      ? tools.filter(t => t.function.name !== 'send_informacoes')
      : tools;
    console.log(`Tools disponíveis para ${userNumber}:`, availableTools.map(t => t.function.name));

    const completion = await getOpenAI().chat.completions.create({
      model: aiModel(),
      temperature: 0.3,
      messages: conversation,
      max_tokens: MAX_TOKENS,
      n: 1,
      tools: availableTools,
      tool_choice: 'auto',
    });

    if (!completion?.choices?.length) {
      throw new Error('OpenAI retornou resposta vazia');
    }

    const choice = completion.choices[0];
    const toolCall = choice.message?.tool_calls?.[0];
    const fnName = toolCall?.function?.name;

    console.log(`Resultado da completude para ${userNumber}:`, choice.finish_reason, fnName || '(texto)');

    // Amostra já enviada — bloqueia nova amostra
    if (hasPreviewBeenSent(userNumber) && fnName === 'send_amostra_gratis') {
      return await generatePersonaReply(
        userNumber,
        'O lead pediu outra prévia mas você já enviou uma. Recuse com carinho e diga que só libera comprando.'
      );
    }

    if (hasSentNaoSouFake[userNumber] && fnName === 'naosou_fake') {
      return await generatePersonaReply(userNumber, 'O lead ainda desconfia. Reafirme com naturalidade que você é real.');
    }

    if (hasSentInformacoes[userNumber] && fnName === 'send_informacoes') {
      return await generatePersonaReply(userNumber, 'O lead pediu os pacotes de novo. Diga que já mandou e pergunte qual ele quer.');
    }

    // Executa a tool chamada
    if (fnName && functionCalls[fnName]) {
      if (fnName === 'send_informacoes' && !hasSentInformacoes[userNumber]) {
        hasSentInformacoes[userNumber] = true;
        await functionCalls[fnName](client, userNumber, conversation);
        return '';
      }
      if (fnName === 'send_amostra_gratis' && !hasPreviewBeenSent(userNumber)) {
        const ok = await functionCalls[fnName](client, userNumber, conversation);
        if (ok) markPreviewSent(userNumber);
        return '';
      }
      if (fnName === 'naosou_fake' && !hasSentNaoSouFake[userNumber]) {
        hasSentNaoSouFake[userNumber] = true;
        await functionCalls[fnName](client, userNumber, conversation);
        return '';
      }
      if (fnName === 'send_chave_pix') {
        await functionCalls[fnName](client, userNumber, conversation);
        return '';
      }
      if (fnName === 'chamada_video' || fnName === 'ignorar_lead') {
        await functionCalls[fnName](client, userNumber, conversation);
        return '';
      }
    }

    const assistantMessage = choice.message?.content || '';
    console.log(`Mensagem do assistente para ${userNumber}:`, assistantMessage);
    conversation.push({ role: "assistant", content: assistantMessage });
    scheduleSaveConversations();
    return assistantMessage;
  } catch (error) {
    const msg = error?.message || String(error);
    const detail = error?.error?.message || error?.response?.data?.error?.message || error?.cause?.message || '';
    const status = error?.status || error?.response?.status;
    console.error('Error in runCompletion:', msg, status ? `(HTTP ${status})` : '', detail ? `— ${detail}` : '');
    throw error;
  }
}

const functionCalls = {
  send_informacoes: async (client, messageFrom, conversation) => {
    const history = userConversations[messageFrom] || [];
    const botMessages = history.filter(m => m.role === 'assistant');
    if (botMessages.length === 0) {
      // Primeira interação: apenas saudar, não enviar tabela ainda
      const greetings = [
        'oii amor 😊 que bom que apareceu por aqui 😈',
        'oiee bb 😈 tava esperando você',
        'oi gato 🔥 sumido por aqui',
        'oii 😍 que bom te ver por aqui'
      ];
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      await sendTextHuman(client, messageFrom, greeting);
      return; // Não envia tabela na primeira interação — deixa a conversa fluir
    }
    await sendInformacoes(client, messageFrom, conversation);
  },
  send_amostra_gratis: async (client, messageFrom, conversation) => sendAmostraGratis(client, messageFrom, conversation),
  send_chave_pix: async (client, messageFrom, conversation) => enviarChavePix(messageFrom, conversation),
  chamada_video: async (client, messageFrom, conversation) => { await chamadaVideo(client, messageFrom, conversation); },
  naosou_fake: async (client, messageFrom, conversation) => { await naosouFake(client, messageFrom, conversation); },
  ignorar_lead: async (client, messageFrom, conversation) => {
    paidUsers[messageFrom] = true; // reusa o flag de silêncio para parar respostas
    console.log(`🚫 Lead ignorado permanentemente: ${messageFrom}`);
  },
};

async function sendInformacoes(client, messageFrom, conversation) {
  try {
    isProcessing[messageFrom] = true;
    console.log('Iniciando send_informacoes para ', messageFrom);

    const tabelaPrecos = pacotesConfig?.texto || `
💎 *MEUS PACOTES* 💎

1️⃣ *PACOTE BÁSICO* - R$ 9,90
   📦 50 fotos e vídeos exclusivos

2️⃣ *CHAMADA VÍDEO* - R$ 15,00
   📹 5 minutos de chamada privada

3️⃣ *PACOTE COMPLETO* - R$ 20,00
   🎁 5 minutos de chamada + 50 fotos e vídeos

Qual pacote te interessa, amor? 💕
`;

    const chat = await client.getChatById(messageFrom);
    if (!chat){
      console.error('❌ Erro ao obter chat para send_informacoes');
      isProcessing[messageFrom] = false;
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await sendTextHuman(client, messageFrom, tabelaPrecos);
      console.log(`✅ Tabela de preços enviada para ${messageFrom}`);

      const descSistema = pacotesConfig?.descricao_sistema || 'Tabela enviada com 3 pacotes: (1) 50 fotos/vídeos R$9,90 (2) Chamada vídeo 5min R$15,00 (3) Chamada 5min + 50 fotos/vídeos R$20,00';
      conversation.push({ role: "system", content: descSistema });
      conversation.push({ role: "assistant", content: 'Qual pacote te interessa, amor? 💕' });
    } catch (sendError) {
      console.error(`❌ Erro ao enviar informações: ${sendError.message}`);
    }

    isProcessing[messageFrom] = false;
  }
  catch (error) {
    console.error('Error sending send_informacoes:', error.message);
    isProcessing[messageFrom] = false;
  }
}
  async function enviarChavePix(messageFrom, conversation) {
    const { pixKey, pixRecipientName } = getPixConfig();
    if (!pixKey) {
      await client.sendMessage(messageFrom, 'Amor, a chave Pix ainda não foi configurada aqui — avisa o admin 😅');
      return false;
    }

    try {
      const lines = [
        `desculpa amor 😘 minha chave Pix é: *${pixKey}*`,
        `manda o comprovante aqui depois que pagar tá? 💕`
      ];
      if (pixRecipientName) {
        lines.splice(1, 0, `Nome: ${pixRecipientName}`);
      }
      for (const line of lines) {
        await sendTextHuman(client, messageFrom, line);
        await new Promise((r) => setTimeout(r, 900));
      }
      console.log(`✅ Chave PIX enviada para ${messageFrom}: ${pixKey}`);
      if (conversation) {
        conversation.push({ role: 'assistant', content: lines.join(' ') });
        conversation.push({ role: 'system', content: `Chave Pix ${pixKey} enviada ao lead.` });
      }
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar chave PIX: ${error.message}`);
      return false;
    }
  }

  async function processarComprovante(messageFrom, message) {
    const isImage = message.hasMedia && message.type === 'image';
    const isDocument = message.hasMedia && message.type === 'document';

    if (!isImage && !isDocument) return false;

    try {
      const media = await message.downloadMedia();
      const mimetype = media.mimetype || message.mimetype || message._data?.mimetype || '';
      const filename = message._data?.filename || '';

      if (isDocument) {
        const isPdf = mimetype.includes('pdf') || /\.pdf$/i.test(filename);
        const isImgDoc = mimetype.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(filename);
        if (!isPdf && !isImgDoc) {
          await client.sendMessage(messageFrom, 'Para comprovante, manda imagem ou PDF, tá?');
          return true;
        }
        console.log(`📄 Documento recebido de ${messageFrom} — mimetype: "${mimetype}" | arquivo: "${filename}"`);
      } else {
        console.log(`🔍 Imagem recebida de ${messageFrom} — analisando comprovante...`);
      }

      let chat = null;
      try {
        chat = await client.getChatById(messageFrom);
      } catch (_) {}

      const readingMs = Math.min(
        18000,
        Math.max(4000, getMessageDelayMs() + Math.random() * 3000)
      );
      console.log(`⏳ Conferindo comprovante (digitando ${Math.round(readingMs / 1000)}s)...`);
      await typingForMs(chat, readingMs);

      const resultado = await validarComprovanteNoPainel(media.data, mimetype, filename);
      const fileType = mimetype.includes('pdf') ? 'pdf' : 'image';

      void panelLog({
        type: 'receipt',
        jid: messageFrom,
        paid: Boolean(resultado.paid),
        confidence: Number(resultado.confidence || 0),
        reason: resultado.reason || '',
        fileType
      });

      if (resultado.paid) {
        console.log(`✅ Comprovante validado para ${messageFrom}`);
        const approvedMsg = await generatePersonaReply(
          messageFrom,
          'O comprovante foi APROVADO após análise. Confirme o pagamento com carinho e diga que vai liberar o acesso — sem mencionar que "recebeu" o comprovante antes.'
        );
        return await confirmarComprovante(messageFrom, approvedMsg);
      }

      const reply = await generatePersonaReply(
        messageFrom,
        `Você acabou de analisar o comprovante e ele NÃO foi aprovado. Motivo: ${resultado.reason || 'valor não confere'}. Peça outro comprovante no seu tom informal e carinhoso — NUNCA diga "recebi seu comprovante" nem fale como atendente.`
      );
      if (reply) {
        await sendTextHuman(client, messageFrom, reply);
        onBotOutbound(messageFrom);
      }
      return true;
    } catch (error) {
      console.error(`❌ Erro ao processar comprovante: ${error.message}`);
      const errReply = await generatePersonaReply(
        messageFrom,
        'Deu erro ao conferir o comprovante. Peça para o lead mandar de novo, no seu tom.'
      );
      if (errReply) {
        await sendTextHuman(client, messageFrom, errReply);
        onBotOutbound(messageFrom);
      }
      return true;
    }
  }

  // Detecta qual pacote o lead comprou — analisa SÓ as mensagens do lead
  async function detectarPacote(messageFrom) {
    const conv = userConversations[messageFrom] || [];

    // Pega apenas as mensagens enviadas pelo lead (não do bot/system)
    const todasMensagensLead = conv
      .filter(m => m.role === 'user' && typeof m.content === 'string');

    if (todasMensagensLead.length === 0) return 'basico';

    // Últimas 5 mensagens do lead (mais recentes = mais relevantes para detectar o que foi comprado)
    const mensagensLead = todasMensagensLead.slice(-5);
    const textoLead = mensagensLead.map(m => m.content).join(' ').toLowerCase();

    // --- PRIORIDADE 1: preço exato mencionado (mais confiável) ---
    const temPreco990  = /9[,.]90/.test(textoLead);
    const temPreco1500 = /15[,.]00/.test(textoLead);
    const temPreco2000 = /20[,.]00/.test(textoLead);

    if (temPreco2000) { console.log(`   Pacote: COMPLETO (preço exato 20,00)`); return 'completo'; }
    if (temPreco1500) { console.log(`   Pacote: CHAMADA (preço exato 15,00)`); return 'chamada'; }
    if (temPreco990)  { console.log(`   Pacote: BASICO (preço exato 9,90)`);   return 'basico'; }

    // --- PRIORIDADE 2: keyword clara de pacote nas últimas mensagens ---
    const temCombo   = /completo|combo|tudo|os.?dois|ambos/i.test(textoLead);
    const temChamada = /chamada|videochamada|video.?chamada|liga[çc][ãa]o/i.test(textoLead);
    const temVal20   = /\b20\b|vinte/i.test(textoLead);
    const temVal15   = /\b15\b|quinze/i.test(textoLead);
    const temBasico  = /b[aá]sico|pack|9[,.]90|\b9\b|nove/i.test(textoLead);

    if (temCombo || temVal20)  { console.log(`   Pacote: COMPLETO (keyword)`); return 'completo'; }
    if (temBasico && !temChamada && !temVal15) { console.log(`   Pacote: BASICO (keyword)`); return 'basico'; }

    // --- PRIORIDADE 3: GPT com contexto completo das últimas 5 mensagens ---
    try {
      const response = await getOpenAI().chat.completions.create({
        model: aiModel(),
        messages: [
          {
            role: 'system',
            content: `Você vai receber as ÚLTIMAS mensagens do lead (cliente). Identifique qual pacote ele CONCORDOU em comprar — ignore perguntas de curiosidade anteriores, foque no que foi COMBINADO/CONFIRMADO.

Pacotes disponíveis:
- BASICO: 50 fotos e vídeos por R$9,90 (mínimo R$5)
- CHAMADA: chamada de vídeo de 5 minutos por R$15,00 (mínimo R$10)
- COMPLETO: chamada + 50 fotos e vídeos por R$20,00 (mínimo R$15)

Regras (siga em ordem):
1. Preço exato mencionado: 9,90→BASICO | 15,00→CHAMADA | 20,00→COMPLETO
2. Valor numérico: 5,6,7,8,9→BASICO | 10,11,12,13,14,15→CHAMADA | 16,17,18,19,20→COMPLETO
3. Palavra-chave: "básico/foto/pack"→BASICO | "chamada/ligação"→CHAMADA | "completo/combo/tudo"→COMPLETO
4. Se o lead perguntou sobre chamada MAS depois escolheu básico/fotos → BASICO
5. Na dúvida → BASICO

Responda APENAS: BASICO, CHAMADA ou COMPLETO.`,
          },
          ...mensagensLead,
        ],
        max_tokens: 10,
        temperature: 0,
      });

      const r = response.choices[0].message.content.trim().toUpperCase();
      const pacote = r.includes('COMPLETO') ? 'completo' : r.includes('CHAMADA') ? 'chamada' : 'basico';
      console.log(`   Pacote detectado: ${pacote.toUpperCase()} (GPT — texto: "${textoLead.slice(0, 100)}")`);
      return pacote;
    } catch {
      // Fallback final
      if (temChamada || temVal15) return 'chamada';
      return 'basico';
    }
  }

  // Aplica etiqueta "Novo Cliente" no WhatsApp
  async function aplicarEtiqueta(messageFrom, nomeEtiqueta) {
    try {
      const labels = await client.getLabels();
      if (!labels || labels.length === 0) return;

      const etiqueta = labels.find(l => l.name.toLowerCase() === nomeEtiqueta.toLowerCase());
      if (!etiqueta) {
        console.log(`⚠️  Etiqueta "${nomeEtiqueta}" não encontrada no WhatsApp`);
        return;
      }

      const chat = await client.getChatById(messageFrom);
      const atuais = (await chat.getLabels()).map(l => l.id);
      if (!atuais.includes(etiqueta.id)) {
        await chat.changeLabels([...atuais, etiqueta.id]);
        console.log(`🏷️  Etiqueta "${nomeEtiqueta}" aplicada em ${messageFrom}`);
      }
    } catch (err) {
      console.error(`❌ Erro ao aplicar etiqueta: ${err.message}`);
    }
  }

  // Notificação no Telegram
  async function notificarTelegram(messageFrom) {
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const numero  = messageFrom.replace('@c.us', '').replace(/^55/, '+55 ');
    const horario = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const texto = `💰 *Novo pagamento recebido!*\n\n📱 Lead: ${numero}\n🤖 Modelo: ${modelName}\n🕐 ${horario}`;

    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: texto,
        parse_mode: 'Markdown',
      });
      console.log('✅ Notificação enviada ao Telegram');
    } catch (err) {
      console.error('❌ Erro ao notificar Telegram:', err.message);
    }
  }

  // Função para confirmar comprovante, entregar conteúdo e silenciar bot
  async function confirmarComprovante(messageFrom, approvedMessage) {
    paidUsers[messageFrom] = true;
    comprovantesRecebidos[messageFrom] = true;

    console.log(`\n💰 [PAGAMENTO CONFIRMADO]`);
    console.log(`   Número: ${messageFrom}`);
    console.log(`   Horário: ${new Date().toLocaleString()}`);

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const config = loadBotConfig();

    try {
      const approvedText =
        approvedMessage ||
        (await generatePersonaReply(
          messageFrom,
          'Pagamento confirmado! Agradeça com carinho e diga que está liberando o acesso.'
        ));
      if (approvedText) await sendTextHuman(client, messageFrom, approvedText);
      await sleep(2000);

      void panelLog({
        type: 'sale',
        jid: messageFrom,
        productName: config.productName || 'VIP',
        amountCents: config.productPriceCents || 4990,
        paymentMethod: config.paymentMethod || 'pix'
      });

      void panelLog({
        type: 'message',
        jid: messageFrom,
        role: 'system',
        content: '[venda] Pagamento confirmado — bot silenciado'
      });

      const delivered = await sendDeliveryMedia(client, messageFrom);
      const productLink = String(config.productDeliveryLink || '').trim();

      if (delivered > 0) {
        console.log(`   📦 ${delivered} arquivo(s) de entrega enviado(s)`);
        void panelLog({
          type: 'message',
          jid: messageFrom,
          role: 'system',
          content: `[entrega] ${delivered} mídia(s) enviada(s)`
        });
      }

      if (productLink) {
        const linkIntro =
          (await generatePersonaReply(
            messageFrom,
            'Pagamento confirmado. Mande uma frase curta com carinho antes do link de acesso.'
          )) || 'Aqui está seu acesso amor, aproveite 😘';
        await sendTextHuman(client, messageFrom, `${linkIntro}\n${productLink}`);
      }

      const pacote = await detectarPacote(messageFrom);
      if (!productLink && delivered === 0) {
        const linkBasico = process.env.LINK_BASICO || '';
        const linkChamada = process.env.LINK_CHAMADA || '';
        const linkCompleto = process.env.LINK_COMPLETO || '';

        console.log(`   Pacote detectado: ${pacote.toUpperCase()} (fallback links)`);

        if (pacote === 'completo') {
          const completoSingle = process.env.COMPLETO_SINGLE === 'true' || pacotesConfig?.completo_single === true;
          if (completoSingle && linkCompleto) {
            const desc = pacotesConfig?.completo_descricao || 'chamada de vídeo';
            await client.sendMessage(messageFrom, `Aqui está o link pra ${desc} amor, é só acessar 😘\n${linkCompleto}`);
          } else {
            if (linkBasico) {
              await client.sendMessage(messageFrom, `Aqui estão suas 50 fotos e vídeos amor, aproveite 😘\n${linkBasico}`);
              await sleep(1500);
            }
            if (linkChamada) {
              await client.sendMessage(messageFrom, `E aqui está o link pra chamada de vídeo, é só acessar 💕\n${linkChamada}`);
            }
          }
        } else if (pacote === 'chamada') {
          if (linkChamada) {
            await client.sendMessage(messageFrom, `Aqui está o link pra chamada amor, é só acessar 😘\n${linkChamada}`);
          }
        } else if (linkBasico) {
          await client.sendMessage(messageFrom, `Aqui estão suas 50 fotos e vídeos amor, aproveite 😘\n${linkBasico}`);
        }
      }

      await aplicarEtiqueta(messageFrom, 'Novo Cliente');
      console.log(`   Conteúdo entregue — bot silenciado para ${messageFrom}\n`);
    } catch (error) {
      console.error(`❌ Erro na entrega: ${error.message}`);
      try {
        await sendTextHuman(
          client,
          messageFrom,
          'Amor, confirmou o pagamento mas deu um probleminha na entrega. Me chama que eu mando manual 💕'
        );
      } catch (_) {}
    }

    await notificarTelegram(messageFrom);
    return true;
  }


async function sendAmostraGratis(client, messageFrom, conversation) {
  try {
    isProcessing[messageFrom] = true;

    const config = loadBotConfig();
    const previewUrls = (config.previewMediaUrls || []).filter(Boolean);

    if (previewUrls.length === 0) {
      console.error('❌ Nenhuma prévia configurada no painel. Faça upload em Instâncias → Editar → Prévia gratuita.');
      isProcessing[messageFrom] = false;
      return false;
    }

    const chat = await client.getChatById(messageFrom);
    let sentCount = 0;

    for (const url of previewUrls) {
      const localPath = await resolveMediaLocalPath(url);
      if (!localPath) {
        console.error(`❌ Prévia não encontrada: ${url}`);
        continue;
      }

      const media = MessageMedia.fromFilePath(localPath);
      if (!media) {
        console.error(`❌ Falha ao carregar prévia: ${url}`);
        continue;
      }

      try {
        const sent = await sendMediaWithTyping(client, messageFrom, media, { caption: '', isViewOnce: true });
        if (sent) {
          sentCount++;
          console.log(`✅ Prévia enviada (view once) (${url}) para ${messageFrom}`);
        }
      } catch (viewOnceError) {
        console.warn(`⚠️ viewOnce falhou (${url}): ${viewOnceError.message} — tentando envio normal`);
        const sent = await sendMediaWithTyping(client, messageFrom, media);
        if (sent) {
          sentCount++;
          console.log(`✅ Prévia enviada (normal) (${url}) para ${messageFrom}`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    if (sentCount === 0) {
      console.error('❌ Nenhuma mídia de prévia pôde ser enviada.');
      isProcessing[messageFrom] = false;
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    await chat.sendStateTyping();
    await new Promise(resolve => setTimeout(resolve, 1500));
    const response = await generatePersonaReply(
      messageFrom,
      'Você acabou de enviar a prévia/amostra gratuita. Pergunte em 1 frase curta se ele gostou.'
    );
    if (response) {
      await sendTextHuman(client, messageFrom, response);
      console.log(`✅ Resposta pós-prévia para ${messageFrom}`);
    }
    conversation.push({ role: "system", content: 'Foi enviado a amostra gratuita. Não ofereça amostras gratuitas novamente.' });
    isProcessing[messageFrom] = false;
    return true;
  } catch (error) {
    console.error('Error sending Amostra Gratis:', error.message);
    isProcessing[messageFrom] = false;
    return false;
  }
}

async function chamadaVideo(client, messageFrom, conversation) {
    try {
      isProcessing[messageFrom] = true;

      const chat = await client.getChatById(messageFrom);

      const videoMessage = `📹 *CHAMADA DE VÍDEO* 📹

Eu faço chamada privada sim amor! 😘

⏱️ *5 MINUTOS* - R$ 15,00

Vamos fazer? 💕`;

      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await sendTextHuman(client, messageFrom, videoMessage);
        console.log(`✅ Informação de chamada de vídeo enviada para ${messageFrom}`);

        conversation.push({ role: "assistant", content: 'Faço chamada de vídeo privada! 5 minutos por R$ 15,00. Quer fazer?' });
        conversation.push({ role: "system", content: 'Foi enviada a informação de chamada de vídeo: 5 minutos por R$15,00.' });
      } catch (sendError) {
        console.error(`❌ Erro ao enviar chamada de vídeo: ${sendError.message}`);
      }

      isProcessing[messageFrom] = false;
    } catch (error) {
      console.error('Error sending chamada_video:', error.message);
      isProcessing[messageFrom] = false;
    }
  }
  async function naosouFake(client, messageFrom, conversation) {
    try {
      isProcessing[messageFrom] = true;
      const text = await generatePersonaReply(
        messageFrom,
        'O lead achou que você é fake ou golpe. Reafirme com naturalidade que é você de verdade, sem soar defensiva.'
      );
      if (text) {
        await sendTextHuman(client, messageFrom, text);
        conversation.push({ role: 'assistant', content: text });
        conversation.push({ role: 'system', content: 'Reafirmou que não é fake.' });
      }
      hasSentNaoSouFake[messageFrom] = true;
      isProcessing[messageFrom] = false;
    } catch (error) {
      console.error('Error sending naosou_fake:', error.message);
      isProcessing[messageFrom] = false;
    }
  }

// ── Timestamp de início — ignora mensagens antigas ao reiniciar ──
const BOT_START_TIME = Math.floor(Date.now() / 1000); // em segundos (igual ao message.timestamp)

// ── Fila global entre leads ──────────────────────────────────
const globalQueue = [];
let isGlobalProcessing = false;
let leadsRespondidos = 0;

const getInterLeadDelay = () => {
  return Math.floor(Math.random() * (120000 - 45000 + 1) + 45000);
};

const getBreakDelay = () => {
  return Math.floor(Math.random() * (300000 - 180000 + 1) + 180000); // 3 a 5 minutos
};

async function processGlobalQueue() {
  if (isGlobalProcessing || globalQueue.length === 0) return;
  isGlobalProcessing = true;
  const task = globalQueue.shift();
  const waiting = globalQueue.length;
  if (waiting > 0) {
    console.log(`📋 [FILA] ${waiting} lead(s) aguardando — respondendo um por vez`);
  }
  try {
    await task();
    leadsRespondidos++;
  } catch (e) {
    console.error('❌ Erro na fila global:', e.message);
  }

  if (globalQueue.length > 0) {
    if (leadsRespondidos > 0 && leadsRespondidos % 5 === 0) {
      const breakDelay = getBreakDelay();
      console.log(`☕ [PAUSA] ${leadsRespondidos} leads respondidos — pausando por ${Math.round(breakDelay / 60000)}min antes do próximo...`);
      await new Promise(resolve => setTimeout(resolve, breakDelay));
    } else {
      const delay = getInterLeadDelay();
      console.log(`⏳ [FILA] Próximo lead em ${Math.round(delay / 1000)}s... (${leadsRespondidos} respondidos, ${globalQueue.length} na fila)`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  isGlobalProcessing = false;
  processGlobalQueue();
}
// ─────────────────────────────────────────────────────────────

client.on("message", async (message) => {
  // Ignora mensagens antigas que chegaram enquanto o bot estava offline
  if (message.timestamp && message.timestamp < BOT_START_TIME) {
    console.log(`⏩ Ignorando mensagem antiga (${Math.round((BOT_START_TIME - message.timestamp))}s antes do bot iniciar)`);
    return;
  }

  const chat = await message.getChat();
  if (message.from.includes('@g.us') || message.from.includes('@broadcast') || chat.archived) {
    return;
  }
  // Verificar se o lead já pagou
  if (comprovantesRecebidos[message.from] || paidUsers[message.from]) {
    console.log(`⏸️  Bot pausado para ${message.from} - Aguardando ação manual`);
    return; // Para de enviar mensagens
  }

  onLeadMessage(message.from);

  // Processar comprovante (APENAS imagem ou PDF, não áudio)
  if (message.hasMedia && (message.type === 'image' || message.type === 'document')) {
    const shouldStop = await processarComprovante(message.from, message);
    if (shouldStop) {
      return; // Para o processamento
    }
  }

  if (isProcessing[message.from]) {
    return;
    }

  if (!messageBuffers[message.from]) {
    messageBuffers[message.from] = [];
  }

  // Processar áudio (ptt = mensagem de voz, audio = arquivo de áudio)
  if (message.hasMedia && (message.type === 'ptt' || message.type === 'audio')) {
    try {
      console.log(`\n🎤 Recebeu áudio de ${message.from} (tipo: ${message.type})`);
      const media = await message.downloadMedia();
      const buffer = Buffer.from(media.data, 'base64');

      // Detecta extensão pelo mimetype para passar ao Whisper corretamente
      const mime = media.mimetype || '';
      const ext = mime.includes('ogg') ? 'ogg'
                : mime.includes('mp4') ? 'mp4'
                : mime.includes('mpeg') || mime.includes('mp3') ? 'mp3'
                : mime.includes('wav') ? 'wav'
                : mime.includes('webm') ? 'webm'
                : 'ogg'; // padrão WhatsApp

      console.log(`⏳ Transcrevendo áudio (${mime} → .${ext})...`);
      const transcribedText = await transcribeAudio(buffer, ext);

      if (transcribedText && transcribedText.trim()) {
        console.log(`📝 Áudio transcrito: "${transcribedText}"`);
        messageBuffers[message.from].push(transcribedText);
      } else {
        console.log(`❌ Não foi possível transcrever o áudio`);
        if (!audioFailures[message.from]) audioFailures[message.from] = 0;
        audioFailures[message.from]++;
        const tentativas = audioFailures[message.from];
        await client.sendMessage(
          message.from,
          tentativas === 1
            ? 'Não entendi direito amor, pode falar de novo ou escrever? 😊'
            : 'Escreve pra mim bb, não tô conseguindo ouvir direito 🙏'
        );
      }
    } catch (audioError) {
      console.error(`❌ Erro ao processar áudio: ${audioError.message}`);
    }
  }
  // Processar imagem
  else if (message.hasMedia && message.type === 'image') {
    console.log(`📸 Recebeu imagem de ${message.from}`);
    // Imagem será processada na função processarComprovante acima
  }
  // Processar texto
  else if (!message.hasMedia) {
    console.log(`\n💬 Recebeu mensagem de ${message.from}`);
    console.log(`   Texto: "${message.body}"`);
    void panelLog({
      type: 'lead',
      jid: message.from,
      displayName: message._data?.notifyName || message.from.replace('@c.us', '')
    });
    void panelLog({
      type: 'message',
      jid: message.from,
      role: 'user',
      content: message.body
    });
    messageBuffers[message.from].push(message.body);
  }

  if (bufferTimers[message.from]) {
    clearTimeout(bufferTimers[message.from]);
  }

  bufferTimers[message.from] = setTimeout(async () => {
    const combinedMessage = messageBuffers[message.from].join(' ');
    messageBuffers[message.from] = [];
    bufferTimers[message.from] = null;

    const from = message.from;

    globalQueue.push(async () => {
      console.log('\n' + '═'.repeat(60));
      console.log('🤖 [PROCESSANDO COM IA]');
      console.log('═'.repeat(60));
      console.log(`📱 De: ${from}`);
      console.log(`💬 Mensagem: "${combinedMessage}"`);
      console.log(`🕐 Hora: ${new Date().toLocaleTimeString('pt-BR')}`);
      console.log(`⏳ Gerando resposta...`);
      console.log('─'.repeat(60) + '\n');
      try {
        const halfReply = tryHalfPriceOffer(from, combinedMessage);
        if (halfReply) {
          await sendTextHuman(client, from, halfReply);
          void panelLog({ type: 'message', jid: from, role: 'assistant', content: halfReply });
          return;
        }
        const result = await runCompletion(from, combinedMessage);

        if (result === '') {
          // Tool call ja enviou tudo (amostra, tabela, etc.)
          return;
        }

        if (result) {
          let { clean, actions } = parsePromptActions(result);
          clean = sanitizePixPlaceholders(clean);
          console.log('✅ RESPOSTA GERADA:');
          console.log('─'.repeat(60));
          console.log(clean || '(somente acoes)');
          if (actions.length) console.log('Tags:', actions.join(', '));
          console.log('─'.repeat(60) + '\n');

          const messageParts = splitMessages(clean);
          if (messageParts.length > 0) {
            isProcessing[from] = true;
            try {
              console.log(`📤 Enviando ${messageParts.length} parte(s) para ${from}...`);
              await sendMessageParts(client, from, messageParts);
              for (const part of messageParts) {
                void panelLog({ type: 'message', jid: from, role: 'assistant', content: part });
              }
              onBotOutbound(from);
              console.log(`✅ Mensagem(ns) enviada(s) com sucesso!\n`);
            } catch (sendError) {
              console.error(`❌ Erro fatal ao enviar mensagens: ${sendError.message}\n`);
            }
            isProcessing[from] = false;
          }

          if (actions.length > 0) {
            await executePromptActions(client, from, actions);
          }

          if (shouldAutoSendPreview(from, combinedMessage, clean, actions)) {
            const ok = await functionCalls.send_amostra_gratis(client, from, getUserConversation(from));
            if (ok) markPreviewSent(from);
          }

          const pixAlreadySent =
            actions.includes('send_chave_pix') ||
            responseContainsPixKey(clean) ||
            messageParts.some((part) => responseContainsPixKey(part));
          if (wantsPixIntent(combinedMessage) && !pixAlreadySent) {
            await enviarChavePix(from, getUserConversation(from));
          }
        } else if (!getOpenAiApiKey()) {
          await sendTextHuman(client, from, 'Oii! Meu sistema de IA ainda não está configurado. Salve a API Key na instância e clique em Salvar (não precisa reconectar o WhatsApp).');
        }
      } catch (completionError) {
        const errMsg = completionError?.message || String(completionError);
        const apiDetail =
          completionError?.error?.message ||
          completionError?.response?.data?.error?.message ||
          '';
        console.error(`❌ Erro ao processar mensagem: ${errMsg}${apiDetail ? ` (${apiDetail})` : ''}\n`);
        isProcessing[from] = false;
        const hint = /model|invalid_api|authentication|api key|incorrect.*key|401|403/i.test(`${errMsg} ${apiDetail}`)
          ? 'Oii! Deu um problema na configuração da IA (modelo ou API Key). Confere no painel da instância, salva de novo e manda outra mensagem. 😊'
          : /timeout|fetch|network|econn|rate|529|503/i.test(`${errMsg} ${apiDetail}`)
            ? 'Oii! A IA demorou pra responder, manda de novo em alguns segundos? 😊'
            : 'Oii! Travou um segundo aqui, manda de novo pra mim? 😊';
        try {
          await sendTextHuman(client, from, hint);
          void panelLog({ type: 'message', jid: from, role: 'assistant', content: hint });
        } catch (_) {}
      }
    });

    processGlobalQueue();
  }, getMessageDelayMs());
});

function splitMessages(text) {
  const complexPattern = /(http[s]?:\/\/[^\s]+)|(www\.[^\s]+)|([^\s]+@[^\s]+\.[^\s]+)|(["'].*?["'])|(\b\d+\.\s)|(\w+\.\w+)/g;
  const placeholders = text.match(complexPattern) ?? [];
  const placeholder = "PLACEHOLDER_";
  let currentIndex = 0;
  const textWithPlaceholders = text.replace(
    complexPattern,
    () => `${placeholder}${currentIndex++}`
  );
  const splitPattern = /(?<!\b\d+\.\s)(?<!\w+\.\w+)[^.?!]+(?:[.?!]+["']?|$)/g;
  let parts = textWithPlaceholders.match(splitPattern) ?? [];
  if (placeholders.length > 0) {
    parts = parts.map(
      (part) => placeholders.reduce(
        (acc, val, idx) => acc.replace(`${placeholder}${idx}`, val),
        part
      )
    );
  }
  return parts;
}

const getDelay = (part) => {
  const delayMin = 3500;
  const stringLength = (part.length / 50) * delayMin;
  if (stringLength < delayMin) return delayMin;
  return Math.min(stringLength, 12000);
};

function humanTypingMs(text) {
  const len = String(text || '').length;
  return Math.min(8000, Math.max(600, len * 32 + 400));
}

/** Envia texto com indicador "digitando..." proporcional ao tamanho da mensagem. */
async function sendTextHuman(client, messageFrom, text) {
  const msg = String(text || '').trim();
  if (!msg) return false;
  try {
    const chat = await client.getChatById(messageFrom);
    const wait = humanTypingMs(msg);
    if (chat) {
      try {
        await chat.sendStateTyping();
      } catch (_) {}
      await new Promise((r) => setTimeout(r, wait));
      await client.sendMessage(messageFrom, msg);
      try {
        await chat.clearState();
      } catch (_) {}
    } else {
      await client.sendMessage(messageFrom, msg);
    }
    return true;
  } catch (error) {
    console.error(`sendTextHuman: ${error.message}`);
    try {
      await client.sendMessage(messageFrom, msg);
    } catch (_) {}
    return false;
  }
}

async function sendMediaWithTyping(client, messageFrom, media, options = {}) {
  try {
    const chat = await client.getChatById(messageFrom);
    if (chat) {
      try {
        await chat.sendStateTyping();
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 2200 + Math.random() * 1800));
    }
    await client.sendMessage(messageFrom, media, options);
    if (chat) {
      try {
        await chat.clearState();
      } catch (_) {}
    }
    return true;
  } catch (error) {
    console.error(`sendMediaWithTyping: ${error.message}`);
    return false;
  }
}

async function sendMessageParts(client, messageFrom, textParts) {
  try {
    const gap = getMessageDelayMs();
    for (let i = 0; i < textParts.length; i++) {
      const part = textParts[i];
      if (!part || part.trim().length === 0) continue;
      await sendTextHuman(client, messageFrom, part);
      if (i < textParts.length - 1) {
        await new Promise((r) => setTimeout(r, gap));
      }
    }
  } catch (error) {
    console.error(`❌ Erro geral em sendMessageParts: ${error.message}`);
  }
}

async function transcribeAudio(fileBuffer, ext = 'ogg') {
  try {
    const formData = new FormData();
    formData.append('file', fileBuffer, `audio.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          Authorization: `Bearer ${getOpenAiApiKey()}`,
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    return response.data.text;
  } catch (error) {
    console.error('Erro ao transcrever áudio:', error.response?.data || error.message);
    return null;
  }
}


//////////////////////////////////////////



app.use(bodyParser.json());
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});
app.get('/auth', (req, res) => {
  res.sendFile(__dirname + '/public/auth.html');
});

// Página de logs em tempo real
app.get('/logs', (req, res) => {
  const lines = parseInt(req.query.lines) || 100;

  // PM2 converte espaços e " - " em "---" no nome do arquivo de log
  // Ex: "Byanca - Facebook" → "Byanca---Facebook"
  const logName = pmName
    ? pmName.replace(/ - /g, '---').replace(/ /g, '-')
    : sessionId;

  const logPath = `/root/.pm2/logs/${logName}-out.log`;

  let logContent = '';
  if (fs.existsSync(logPath)) {
    const all = fs.readFileSync(logPath, 'utf8').split('\n');
    logContent = all.slice(-lines).join('\n');
  } else {
    logContent = `Arquivo de log não encontrado: ${logPath}`;
  }

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Logs — ${modelName}</title>
  <meta http-equiv="refresh" content="5">
  <style>
    body { background:#0d0d0d; color:#00ff88; font-family:monospace; font-size:13px; margin:0; padding:16px; }
    h2 { color:#fff; margin:0 0 8px; }
    .meta { color:#888; font-size:11px; margin-bottom:12px; }
    pre { white-space:pre-wrap; word-break:break-all; line-height:1.6; }
    .err { color:#ff4444; }
  </style>
</head>
<body>
  <h2>📋 Logs — ${modelName}</h2>
  <div class="meta">Porta: ${port} | Atualiza a cada 5s | <a href="/logs?lines=200" style="color:#888">200 linhas</a> | <a href="/logs?lines=500" style="color:#888">500 linhas</a></div>
  <pre>${logContent.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
  <script>window.scrollTo(0, document.body.scrollHeight);</script>
</body>
</html>`);
});

app.post('/api/messages', (req, res) => {
  const { message } = req.body;

  if (message) {
    try {
      const messages = loadMessages();
      messages[0] = message; 
      saveMessages(messages);

      console.log('Mensagem salva com sucesso:', message);
      res.sendStatus(200);
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
      res.status(500).send('Erro ao salvar mensagem.');
    }
  } else {
    res.status(400).send('Mensagem inválida.');
  }
});

app.get('/api/messages', (req, res) => {
  try {
    const messages = loadMessages();
    res.json(messages);
  } catch (error) {
    console.error('Erro ao carregar mensagens:', error);
    res.status(500).send('Erro ao carregar mensagens.');
  }
});

function loadMessages() {
  try {
    const data = fs.readFileSync('messages.json');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function saveMessages(messages) {
  const data = JSON.stringify(messages);
  fs.writeFileSync('messages.json', data);
}

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.use(fileUpload({
  debug: true
}));
app.use("/", express.static(__dirname + "/"));

// Rota para servir o formulário de prompt
app.get('/', (req, res) => {
  res.sendFile('prompt-form.html', {
    root: __dirname
  });
});

// API para obter o prompt customizado
app.get('/api/prompt', (req, res) => {
  res.json({ prompt: customPrompt || '' });
});

// API para salvar o prompt customizado
app.post('/api/prompt', (req, res) => {
  const { prompt } = req.body;

  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Prompt não pode estar vazio!'
    });
  }

  if (saveCustomPrompt(prompt.trim())) {
    // Limpar conversas anteriores para usar o novo prompt
    Object.keys(userConversations).forEach(key => {
      userConversations[key] = [
        { role: "system", content: customPrompt }
      ];
      hasSentInformacoes[key] = false;
      hasSentAmostra[key] = Boolean(loadPreviewSentStore()[key]);
      hasSentNaoSouFake[key] = false;
    });

    res.json({
      success: true,
      message: 'Prompt salvo com sucesso!'
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Erro ao salvar prompt'
    });
  }
});

let cachedWhatsappNumber = null;
try {
  if (fs.existsSync(statusFilePath)) {
    const prev = JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
    if (prev.whatsappNumber) cachedWhatsappNumber = prev.whatsappNumber.trim();
  }
} catch (_) {}

function persistWhatsappNumber() {
  try {
    if (client && client.info && client.info.wid) {
      cachedWhatsappNumber = client.info.wid._serialized || String(client.info.wid);
      writeConnectionStatus(connectionState, lastErrorMessage, cachedWhatsappNumber);
      console.log(`📱 Número conectado: ${cachedWhatsappNumber}`);
      return true;
    }
  } catch (error) {
    console.error(`⚠️ Erro ao salvar WhatsApp number: ${error.message}`);
  }
  return false;
}

function schedulePersistWhatsappNumber() {
  [0, 1500, 4000, 8000].forEach((ms) => {
    setTimeout(() => {
      if (!cachedWhatsappNumber) persistWhatsappNumber();
    }, ms);
  });
}

app.get('/api/status', (_req, res) => {
  const connected = connectionState === 'ready' || connectionState === 'authenticated';
  if (connected && !cachedWhatsappNumber) persistWhatsappNumber();
  return res.json({
    ok: true,
    state: connectionState,
    connected,
    whatsappNumber: cachedWhatsappNumber || undefined,
    qrAvailable: connectionState === 'qr_pending' && Boolean(lastQrUrl),
    error: lastErrorMessage || undefined,
    chromium: chromiumPath || null,
    instanceDir: instancesDataDir,
    aiModel: process.env.AI_MODEL || undefined,
    aiProvider: process.env.AI_PROVIDER || undefined
  });
});

app.get('/api/phone', (_req, res) => {
  const connected = connectionState === 'ready' || connectionState === 'authenticated';
  if (connected) persistWhatsappNumber();
  return res.json({
    ok: true,
    connected,
    whatsappNumber: cachedWhatsappNumber || null
  });
});

app.post('/api/logout', async (_req, res) => {
  try {
    lastQrUrl = null;
    cachedWhatsappNumber = '';
    try {
      if (fs.existsSync(qrFilePath)) fs.unlinkSync(qrFilePath);
    } catch (_) {}
    purgeSessionDir();
    writeConnectionStatus('starting', '', '');
    try {
      await client.logout();
    } catch (_) {}
    try {
      await client.destroy();
    } catch (_) {}
    client.initialize().catch((error) => {
      const message = error?.message || String(error);
      console.error('❌ Falha ao reinicializar após logout:', message);
      writeConnectionStatus('error', message);
    });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

// Envio externo (remarketing do painel) — whatsapp-web.js client.sendMessage
app.post('/api/send', async (req, res) => {
  const to = req.body?.to;
  const message = req.body?.message;
  if (!to || !message) {
    return res.status(400).json({ ok: false, error: 'to e message obrigatorios' });
  }
  const connected = connectionState === 'ready' || connectionState === 'authenticated';
  if (!connected) {
    return res.status(503).json({
      ok: false,
      error: 'WhatsApp nao conectado. Escaneie o QR Code no painel.',
      state: connectionState
    });
  }
  try {
    await client.sendMessage(to, message);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

server.listen(port, function() {
  console.log(`\n🚀 [SESSION: ${sessionId}]`);
  console.log(`📱 Modelo: ${modelName}`);
  console.log(`🔌 Porta: ${port}`);
  console.log(`🌐 URL: http://localhost:${port}`);
  console.log('⏳ Conectando ao WhatsApp...\n');

  // Carregar prompt customizado
  loadCustomPrompt();
});

const clientSockets = {};
let lastQrUrl = null;

// Único listener de QR — envia para o site via socket
client.on('qr', (qr) => {
  console.log(`📱 QR Code gerado — acesse http://localhost:${port} para escanear`);
  writeConnectionStatus('qr_pending');

  qrcode.toDataURL(qr, (err, url) => {
    if (err) return;
    lastQrUrl = url;
    Object.values(clientSockets).forEach(socket => {
      socket.emit('message', 'QRCode recebido, faça a leitura com o seu Whatsapp!');
      socket.emit('qr', url);
    });
    // Salva QR para o painel admin
    try {
      fs.writeFileSync(qrFilePath, JSON.stringify({
        qr: url,
        raw: qr,
        ts: Date.now()
      }));
    } catch (_) {}
  });
});

io.on('connection', function(socket) {
  socket.emit('message', 'BOT Iniciado! Criando sessão. Aguarde.');

  // Se já tem QR disponível (ex: página recarregada), envia imediatamente
  if (lastQrUrl) {
    socket.emit('message', 'QRCode recebido, faça a leitura com o seu Whatsapp!');
    socket.emit('qr', lastQrUrl);
  }

  clientSockets[socket.id] = socket;
});

client.on('ready', () => {
  writeConnectionStatus('ready', '', cachedWhatsappNumber);
  persistWhatsappNumber();
  schedulePersistWhatsappNumber();
  Object.values(clientSockets).forEach(socket => {
    socket.emit('ready', 'Dispositivo pronto!');
    socket.emit('message', 'Dispositivo pronto!');
  });
  // Remove QR quando conectado
  try {
    if (fs.existsSync(qrFilePath)) fs.unlinkSync(qrFilePath);
  } catch (_) {}
  lastQrUrl = null;
  console.log(chalk.bold.green('\n✅ ========================================'));
  console.log(chalk.bold.green('🚀 BOT CONECTADO E PRONTO PARA USAR!'));
  console.log(chalk.bold.green('========================================\n'));
  console.log(chalk.cyan(`📱 Modelo: ${modelName}`));
  console.log(chalk.cyan(`🔌 Porta: ${port}`));
  console.log(chalk.cyan(`📍 Sessão: ${sessionId}\n`));
  console.log(chalk.yellow('O bot está aguardando mensagens dos leads...\n'));
});

client.on('authenticated', () => {
  writeConnectionStatus('authenticated', '', cachedWhatsappNumber);
  schedulePersistWhatsappNumber();
  Object.values(clientSockets).forEach(socket => {
    socket.emit('authenticated', 'Autenticado!');
    socket.emit('message', 'Autenticado!');
  });
  console.log(chalk.bold.cyan('\n📱 ========================================'));
  console.log(chalk.bold.cyan('✅ Autenticado com WhatsApp!'));
  console.log(chalk.bold.cyan('Conectando ao bot...'));
  console.log(chalk.bold.cyan('========================================\n'));

  // Atualizar sessionManager com número do WhatsApp
  try {
    if (client.info && client.info.wid) {
      const whatsappNumber = client.info.wid._serialized || client.info.wid.toString();
      cachedWhatsappNumber = whatsappNumber;
      writeConnectionStatus(connectionState, lastErrorMessage, whatsappNumber);
      sessionManager.updateSessionStatus(sessionId, 'connected', whatsappNumber);
      console.log(`📱 Número conectado: ${whatsappNumber}`);
    }
  } catch (error) {
    console.error(`⚠️ Erro ao atualizar WhatsApp number: ${error.message}`);
  }

  // Abrir o navegador automaticamente
  setTimeout(() => {
    try {
      exec(`start http://localhost:${port}`);
    } catch (err) {
      console.log('Não foi possível abrir o navegador automaticamente.');
      console.log(`Acesse manualmente: http://localhost:${port}`);
    }
  }, 1000);
});

// ── Notificação Telegram de desconexão ───────────────────────────────────────
async function notificarTelegramDesconexao(motivo) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  // Tenta pegar o número do WhatsApp salvo na sessão
  let numero = 'Desconhecido';
  try {
    const sessions = sessionManager.getActiveSessions();
    const session  = sessions.find(s => s.id === sessionId);
    if (session?.whatsappNumber) {
      numero = session.whatsappNumber.replace('@c.us', '').replace(/^55/, '+55 ');
    }
  } catch (_) {}

  const horario = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const texto = [
    `⚠️ *WhatsApp Desconectado!*`,
    ``,
    `📱 Número: ${numero}`,
    `🤖 Instância: ${modelName}`,
    `❌ Motivo: ${motivo || 'Desconhecido'}`,
    `🕐 ${horario}`,
  ].join('\n');

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: texto,
      parse_mode: 'Markdown',
    });
    console.log('📣 Notificação de desconexão enviada ao Telegram');
  } catch (err) {
    console.error('❌ Erro ao notificar Telegram desconexão:', err.message);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

client.on('auth_failure', function() {
  writeConnectionStatus('auth_failure');
  Object.values(clientSockets).forEach(socket => {
    socket.emit('message', 'Falha na autenticação, aguarde um novo código');
  });
  console.error('Falha na autenticação');
  notificarTelegramDesconexao('Falha na autenticação');

  try {
    sessionManager.updateSessionStatus(sessionId, 'error');
  } catch (error) {
    console.error(`⚠️ Erro ao atualizar status: ${error.message}`);
  }
});

client.on('change_state', state => {
  console.log('Status de conexão:', state);
});

client.on('disconnected', (reason) => {
  writeConnectionStatus('disconnected');
  lastQrUrl = null;
  Object.values(clientSockets).forEach(socket => {
    socket.emit('message', 'Cliente desconectado!');
  });
  console.log('Cliente desconectado', reason);
  notificarTelegramDesconexao(reason || 'Conexão perdida');

  try {
    sessionManager.updateSessionStatus(sessionId, 'disconnected');
  } catch (error) {
    console.error(`⚠️ Erro ao atualizar status: ${error.message}`);
  }

  client.initialize();
});
