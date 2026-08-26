/**
 * Motor Telegram — conta de USUÁRIO via MTProto (GramJS).
 * Não usa Bot API. Fluxo: Telegram pessoal → IA → Telegram pessoal.
 */
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const express = require("express");
const axios = require("axios");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { Api } = require("telegram/tl");

const args = process.argv.slice(2);
let port = 4200;
let sessionId = "tg-default";
let modelName = "Telegram";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && i + 1 < args.length) port = parseInt(args[i + 1], 10);
  if (args[i] === "--sessionId" && i + 1 < args.length) sessionId = args[i + 1];
  if (args[i] === "--modelName" && i + 1 < args.length) modelName = args[i + 1];
}

const instancesDataDir = process.env.TG_INSTANCE_DIR || path.join(__dirname, ".tg_data", sessionId);
if (!fs.existsSync(instancesDataDir)) fs.mkdirSync(instancesDataDir, { recursive: true });

const sessionFilePath = path.join(instancesDataDir, "session.txt");
const statusFilePath = path.join(instancesDataDir, "status.json");
const errorFilePath = path.join(instancesDataDir, "error.txt");
const botConfigPath = path.join(instancesDataDir, "bot-config.json");
const promptFilePath = path.join(instancesDataDir, "prompt.json");
const conversationsStorePath = path.join(instancesDataDir, "conversations-store.json");

let connectionState = "starting";
let lastErrorMessage = "";
let connectedAs = "";
let codeResolver = null;
let passwordResolver = null;
let pendingCodeHint = "";

function writeConnectionStatus(state, errorMessage) {
  connectionState = state;
  if (errorMessage) lastErrorMessage = String(errorMessage);
  else if (state === "ready" || state === "authenticated") lastErrorMessage = "";
  const payload = {
    state,
    at: new Date().toISOString(),
    error: lastErrorMessage || undefined,
    connectedAs: connectedAs || undefined,
    pendingCodeHint: pendingCodeHint || undefined
  };
  try {
    fs.writeFileSync(statusFilePath, JSON.stringify(payload, null, 2));
    if (errorMessage) fs.writeFileSync(errorFilePath, String(errorMessage));
    else if (fs.existsSync(errorFilePath)) fs.unlinkSync(errorFilePath);
  } catch (_) {}
}

function loadBotConfig() {
  try {
    if (fs.existsSync(botConfigPath)) return JSON.parse(fs.readFileSync(botConfigPath, "utf8"));
  } catch (_) {}
  return { pixKey: "", pixRecipientName: "", products: [], messageDelayMs: 2500 };
}

function loadPrompt() {
  try {
    if (fs.existsSync(promptFilePath)) {
      const parsed = JSON.parse(fs.readFileSync(promptFilePath, "utf8"));
      const text = String(parsed.prompt || "").trim();
      if (text) return text;
    }
  } catch (_) {}
  return (
    process.env.BOT_PROMPT ||
    "Você atende leads no Telegram de forma natural, curta e carinhosa. Venda seus packs."
  );
}

function loadSessionString() {
  try {
    if (fs.existsSync(sessionFilePath)) return fs.readFileSync(sessionFilePath, "utf8").trim();
  } catch (_) {}
  return process.env.TG_SESSION || "";
}

function saveSessionString(value) {
  fs.writeFileSync(sessionFilePath, String(value || ""), "utf8");
}

const conversations = {};
function loadConversations() {
  try {
    if (!fs.existsSync(conversationsStorePath)) return;
    const data = JSON.parse(fs.readFileSync(conversationsStorePath, "utf8"));
    if (data.conversations) Object.assign(conversations, data.conversations);
  } catch (_) {}
}
function saveConversations() {
  try {
    const trimmed = {};
    for (const [id, conv] of Object.entries(conversations)) {
      if (!Array.isArray(conv)) continue;
      trimmed[id] = conv.slice(-40);
    }
    fs.writeFileSync(conversationsStorePath, JSON.stringify({ conversations: trimmed }, null, 2));
  } catch (_) {}
}

function getConversation(chatId) {
  const key = String(chatId);
  if (!conversations[key]) {
    conversations[key] = [{ role: "system", content: buildSystemPrompt() }];
  }
  return conversations[key];
}

function buildSystemPrompt() {
  const cfg = loadBotConfig();
  const pixKey = String(process.env.PIX_KEY || cfg.pixKey || "").trim();
  const pixName = String(process.env.PIX_RECIPIENT || cfg.pixRecipientName || modelName || "").trim();
  let prompt = loadPrompt();
  prompt +=
    "\n\n--- TELEGRAM ---\n" +
    "Você está no Telegram (conta pessoal). Responda só em chats privados.\n" +
    "NUNCA diga que é bot ou IA.\n" +
    "Máximo 2 frases por mensagem.\n";

  const library = getAudioLibrary();
  if (library.length) {
    prompt +=
      "\nÁUDIOS (notas de voz): quando for mandar áudio, responda SOMENTE com a tag, sem texto junto " +
      '(ex: só "[[audio:nao_sou_fake]]"). NUNCA anuncie o áudio.\n';
    for (const a of library) {
      const slug = audioItemSlug(a);
      if (!slug) continue;
      const triggers = String(a.triggers || a.keywords || "").trim();
      prompt += `- [[audio:${slug}]] → ${a.label || slug}` + (triggers ? ` (gatilhos: ${triggers})` : "") + "\n";
    }
  }

  if (pixKey) {
    prompt += `\nChave Pix real: ${pixKey}` + (pixName ? ` (nome: ${pixName})` : "") + "\n";
    prompt += "Quando o lead quiser pagar, envie a chave Pix completa na mensagem.\n";
  }
  const products = Array.isArray(cfg.products) ? cfg.products : [];
  if (products.length) {
    prompt +=
      "\nPacotes:\n" +
      products.map((p) => `- ${p.name}: R$ ${((p.priceCents || 0) / 100).toFixed(2).replace(".", ",")}`).join("\n") +
      "\n";
  }
  return prompt;
}

async function panelLog(payload) {
  const panelUrl = process.env.PANEL_URL;
  const secret = process.env.INTERNAL_SECRET;
  const botId = process.env.BOT_ID || sessionId;
  if (!panelUrl || !secret) return;
  try {
    await axios.post(
      `${panelUrl}/internal/events`,
      { ...payload, botId },
      { headers: { "x-internal": secret, "content-type": "application/json" }, timeout: 8000, validateStatus: () => true }
    );
  } catch (_) {}
}

const OpenAI = require("openai");
let openai = null;
function getOpenAI() {
  if (openai) return openai;
  const key = process.env.OPENAI_API_KEY || "";
  if (!key) throw new Error("OPENAI_API_KEY ausente");
  const baseURL = process.env.AI_BASE_URL || undefined;
  openai = new OpenAI({ apiKey: key, ...(baseURL ? { baseURL } : {}) });
  return openai;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Áudios / notas de voz (mesmo padrão do WhatsApp: OGG Opus + voice note) ──
const sentAudios = {};
const AUDIO_STOP_WORDS = new Set(["amor", "bebe", "bb", "oi", "oie", "ola", "hey", "sim", "nao", "ok"]);

function normalizeAudioKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAudioSlug(value) {
  return normalizeAudioKey(value).replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function audioItemSlug(item) {
  return normalizeAudioSlug((item && (item.slug || item.label)) || "");
}

function audioItemTriggers(item) {
  const raw = ((item && (item.triggers || item.keywords)) || "").trim();
  return raw
    .split(",")
    .map((k) => normalizeAudioKey(k))
    .filter((k) => k.length >= 4 && !AUDIO_STOP_WORDS.has(k));
}

function getAudioLibrary() {
  return (loadBotConfig().audioLibrary || []).filter((a) => a && a.url);
}

function resolveAudioBySlug(slug, library) {
  const norm = normalizeAudioSlug(slug);
  if (!norm || !Array.isArray(library)) return null;
  return library.find((it) => audioItemSlug(it) === norm) || null;
}

function parseAudioTagSlugs(text) {
  const slugs = [];
  const re = /\[\[audio:([a-z0-9_]+)\]\]|\[\[audio_([a-z0-9_]+)\]\]/gi;
  let m;
  while ((m = re.exec(String(text || ""))) !== null) {
    const s = normalizeAudioSlug(m[1] || m[2] || "");
    if (s) slugs.push(s);
  }
  return [...new Set(slugs)];
}

function audioAlreadySent(chatId, slug) {
  const key = String(chatId);
  return Array.isArray(sentAudios[key]) && sentAudios[key].includes(slug);
}

function markAudioSent(chatId, slug) {
  const key = String(chatId);
  if (!Array.isArray(sentAudios[key])) sentAudios[key] = [];
  if (!sentAudios[key].includes(slug)) sentAudios[key].push(slug);
}

function isGreetingText(text) {
  return /^(oi+|oii+|oie+|ol[aá]|bom dia|boa tarde|boa noite|e ai|eai|hey|hi|hello)[\s!.?😊🙂❤️]*$/i.test(
    String(text || "").trim()
  );
}

function isFirstUserMessage(chatId) {
  const conv = conversations[String(chatId)] || [];
  return conv.filter((m) => m.role === "user").length <= 1;
}

function resolveSaudacaoAudio() {
  return resolveAudioBySlug("saudacao", getAudioLibrary());
}

function findContextualLeadAudio(text, library) {
  if (!Array.isArray(library) || !library.length) return null;
  const norm = normalizeAudioKey(text);
  if (!norm) return null;
  let best = null;
  for (const item of library) {
    for (const trigger of audioItemTriggers(item)) {
      let score = 0;
      if (norm === trigger) score = 100;
      else if (norm.includes(trigger)) score = 70 + Math.min(trigger.length, 25);
      if (score > (best ? best.score : 0)) best = { item, score };
    }
  }
  if (best && best.score >= 60) return best.item;
  if (/fake|golpe|golp|é bot|e bot|rob[oô]|\bia\b|desconfi|scam|fraude/i.test(String(text || ""))) {
    return (
      library.find(
        (a) =>
          /nao.?sou.?fake|naosou_fake|fake|golpe/.test(audioItemSlug(a)) ||
          /fake|golpe|bot|desconfi/.test(((a.triggers || a.keywords) || "").toLowerCase())
      ) || null
    );
  }
  return null;
}

function pickFunnelAudios(input) {
  const library = input.library || [];
  const picks = [];
  const seen = new Set();
  const add = (item) => {
    if (!item) return;
    const slug = audioItemSlug(item);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    picks.push(item);
  };
  for (const slug of input.audioSlugs || []) add(resolveAudioBySlug(slug, library));
  if (picks.length === 0) add(findContextualLeadAudio(input.userText, library));
  return picks.slice(0, 1);
}

function resolveMediaLocalPath(url) {
  const clean = String(url || "").trim();
  if (!clean) return null;
  if (fs.existsSync(clean)) return clean;

  if (clean.includes("/seed-audios/")) {
    const seedName = path.basename(clean.split("?")[0]);
    const candidates = [
      path.join(__dirname, "..", "assets", "seed-audios", seedName),
      path.join(__dirname, "..", "hotbot", seedName),
      path.join(process.cwd(), "..", "assets", "seed-audios", seedName),
      path.join(process.cwd(), "assets", "seed-audios", seedName)
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }

  const baseName = path.basename(clean.split("?")[0]);
  const uploadsDir = process.env.UPLOADS_DIR;
  const candidates = [];
  if (uploadsDir) {
    candidates.push(path.join(uploadsDir, baseName));
    if (clean.includes("/uploads/")) {
      candidates.push(path.join(uploadsDir, clean.split("/uploads/")[1].split("?")[0]));
    }
  }
  candidates.push(path.join(instancesDataDir, "uploads", baseName));
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

let ffmpegAvailable = null;
function hasFfmpeg() {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  try {
    execFile("ffmpeg", ["-version"], { timeout: 5000 }, (err) => {
      ffmpegAvailable = !err;
    });
  } catch (_) {
    ffmpegAvailable = false;
  }
  try {
    require("child_process").execFileSync("ffmpeg", ["-version"], { stdio: "ignore", timeout: 5000 });
    ffmpegAvailable = true;
  } catch (_) {
    ffmpegAvailable = false;
  }
  return ffmpegAvailable;
}

function toVoiceOgg(localPath) {
  return new Promise((resolve) => {
    try {
      const ext = path.extname(localPath).toLowerCase();
      if (ext === ".ogg" || ext === ".opus") return resolve(localPath);
      if (!hasFfmpeg()) return resolve(null);

      const cacheDir = path.join(instancesDataDir, "voice-cache");
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      const base = path.basename(localPath).replace(/[^a-zA-Z0-9._-]/g, "-");
      const outPath = path.join(cacheDir, `${base}.ogg`);
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) return resolve(outPath);

      execFile(
        "ffmpeg",
        ["-y", "-i", localPath, "-vn", "-c:a", "libopus", "-b:a", "64k", "-ar", "48000", "-ac", "1", outPath],
        { timeout: 30000 },
        (err) => {
          if (err) {
            console.error(`❌ ffmpeg TG: ${err.message}`);
            return resolve(null);
          }
          if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) return resolve(outPath);
          resolve(null);
        }
      );
    } catch (error) {
      console.error(`❌ toVoiceOgg TG: ${error.message}`);
      resolve(null);
    }
  });
}

/** Envia nota de voz no Telegram (voice_note) — equivalente ao PTT do WhatsApp. */
async function sendNamedAudioVoiceOnce(peer, chatId, item) {
  if (!item || !item.url) return false;
  const slug = audioItemSlug(item);
  if (audioAlreadySent(chatId, slug)) {
    console.log(`⏩ Áudio TG "${slug}" já enviado — ignorando`);
    return false;
  }

  const localPath = resolveMediaLocalPath(item.url);
  if (!localPath || !fs.existsSync(localPath)) {
    console.error(`❌ Áudio TG não encontrado: ${item.url}`);
    return false;
  }

  const oggPath = (await toVoiceOgg(localPath)) || localPath;

  try {
    await client.invoke(
      new Api.messages.SetTyping({
        peer,
        action: new Api.SendMessageRecordAudioAction()
      })
    );
  } catch (_) {}

  await sleep(1800 + Math.random() * 1800);

  try {
    await client.sendFile(peer, {
      file: oggPath,
      voiceNote: true,
      forceDocument: false
    });
    markAudioSent(chatId, slug);
    console.log(`✅ Nota de voz TG "${slug}" enviada`);
    return true;
  } catch (error) {
    console.error(`❌ Falha ao enviar voz TG "${slug}":`, error?.message || error);
    return false;
  }
}

async function generateReply(chatId, userText) {
  const conv = getConversation(chatId);
  if (conv[0]?.role === "system") conv[0].content = buildSystemPrompt();
  conv.push({ role: "user", content: userText });
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const completion = await getOpenAI().chat.completions.create({
    model,
    messages: conv.filter((m) => m.role === "system" || m.role === "user" || m.role === "assistant").slice(-24),
    max_tokens: 280,
    temperature: 0.85
  });
  let raw = String(completion.choices[0]?.message?.content || "").trim();
  const audioSlugs = parseAudioTagSlugs(raw);
  let text = raw.replace(/\[\[.*?\]\]/g, "").trim();
  conv.push({ role: "assistant", content: raw || text });
  saveConversations();
  return { text, audioSlugs, raw };
}

const apiId = Number(process.env.TG_API_ID || 0);
const apiHash = String(process.env.TG_API_HASH || "").trim();
const phone = String(process.env.TG_PHONE || "").trim();

if (!apiId || !apiHash) {
  writeConnectionStatus("error", "Configure TELEGRAM_API_ID e TELEGRAM_API_HASH (my.telegram.org).");
  console.error("❌ TG_API_ID / TG_API_HASH obrigatórios");
  process.exit(1);
}

const stringSession = new StringSession(loadSessionString());
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 8,
  deviceModel: "OnlyChat Panel",
  appVersion: "1.0",
  systemVersion: "Node",
  useWSS: true
});

loadConversations();
writeConnectionStatus("starting");

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    state: connectionState,
    connected: connectionState === "ready" || connectionState === "authenticated",
    connectedAs: connectedAs || undefined,
    error: lastErrorMessage || undefined,
    pendingCodeHint: pendingCodeHint || undefined,
    platform: "telegram"
  });
});

app.post("/api/code", (req, res) => {
  const code = String(req.body?.code || "").trim();
  if (!code) return res.status(400).json({ ok: false, error: "Informe o código" });
  if (!codeResolver) return res.status(409).json({ ok: false, error: "Nenhum código pendente agora" });
  const resolve = codeResolver;
  codeResolver = null;
  pendingCodeHint = "";
  resolve(code);
  writeConnectionStatus("authenticating");
  return res.json({ ok: true });
});

app.post("/api/password", (req, res) => {
  const password = String(req.body?.password || "");
  if (!password) return res.status(400).json({ ok: false, error: "Informe a senha 2FA" });
  if (!passwordResolver) return res.status(409).json({ ok: false, error: "Nenhuma senha 2FA pendente" });
  const resolve = passwordResolver;
  passwordResolver = null;
  resolve(password);
  writeConnectionStatus("authenticating");
  return res.json({ ok: true });
});

app.post("/api/logout", async (_req, res) => {
  try {
    await client.logOut();
  } catch (_) {}
  try {
    if (fs.existsSync(sessionFilePath)) fs.unlinkSync(sessionFilePath);
  } catch (_) {}
  writeConnectionStatus("logged_out", "Sessão Telegram encerrada. Reinicie e entre de novo.");
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 500);
});

client.addEventHandler(async (event) => {
  try {
    if (event.isGroup || event.isChannel) return;
    if (!event.isPrivate) return;
    const msg = event.message;
    if (!msg || msg.out) return;

    const sender = await event.getSender();
    const chatId = Number(msg.chatId || sender?.id || 0);
    const displayName =
      [sender?.firstName, sender?.lastName].filter(Boolean).join(" ") ||
      sender?.username ||
      String(chatId);
    const text = String(msg.message || "").trim();
    if (!text) return;

    console.log(`💬 [${displayName}] ${text}`);
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

    const peer = await event.getInputChat();
    const delay = Number(loadBotConfig().messageDelayMs) || 2500;
    await sleep(Math.round(delay * (0.85 + Math.random() * 0.3)));

    // Saudação em áudio no primeiro "oi" (igual WhatsApp)
    if (isGreetingText(text) && isFirstUserMessage(chatId)) {
      const conv = getConversation(chatId);
      conv.push({ role: "user", content: text });
      const saudacao = resolveSaudacaoAudio();
      if (saudacao) {
        const ok = await sendNamedAudioVoiceOnce(peer, chatId, saudacao);
        if (ok) {
          conv.push({ role: "system", content: "Áudio de saudação já enviado. Não repita; siga o funil." });
          saveConversations();
          return;
        }
      }
    }

    const result = await generateReply(chatId, text);
    const library = getAudioLibrary();
    const audioPicks = pickFunnelAudios({
      audioSlugs: result.audioSlugs,
      userText: text,
      library
    });

    let anyAudio = false;
    for (const item of audioPicks) {
      const ok = await sendNamedAudioVoiceOnce(peer, chatId, item);
      if (ok) anyAudio = true;
    }

    // Se mandou áudio, não manda texto robótico junto (mesmo padrão do WhatsApp)
    const replyText = anyAudio ? "" : result.text || "oii amor, me fala melhor o que você quer? 💕";
    if (replyText) {
      try {
        await client.invoke(
          new Api.messages.SetTyping({
            peer,
            action: new Api.SendMessageTypingAction()
          })
        );
      } catch (_) {}
      await event.respond(replyText);
      void panelLog({
        type: "message",
        jid: `tg:${chatId}`,
        chatId,
        role: "assistant",
        content: replyText
      });
      console.log(`✅ Resposta TG: ${replyText}`);
    } else if (anyAudio) {
      void panelLog({
        type: "message",
        jid: `tg:${chatId}`,
        chatId,
        role: "assistant",
        content: `[audio:${audioPicks.map((a) => audioItemSlug(a)).join(",")}]`
      });
    }
  } catch (error) {
    console.error("Erro ao processar mensagem TG:", error?.message || error);
  }
}, new NewMessage({ incoming: true }));

async function startTelegram() {
  try {
    writeConnectionStatus("connecting");
    console.log(`🔐 Telegram MTProto · ${modelName} · porta ${port}`);
    console.log(`📱 Telefone: ${phone || "(sessão salva)"}`);

    await client.start({
      phoneNumber: async () => {
        if (!phone) throw new Error("TG_PHONE não configurado");
        return phone;
      },
      phoneCode: async () => {
        pendingCodeHint = "Digite o código que o Telegram enviou no app/SMS";
        writeConnectionStatus("need_code");
        console.log("⏳ Aguardando código do Telegram (painel → Conectar Telegram)...");
        return await new Promise((resolve) => {
          codeResolver = resolve;
        });
      },
      password: async () => {
        pendingCodeHint = "Conta com 2FA — informe a senha cloud";
        writeConnectionStatus("need_password");
        console.log("⏳ Aguardando senha 2FA...");
        return await new Promise((resolve) => {
          passwordResolver = resolve;
        });
      },
      onError: (err) => {
        console.error("Telegram auth error:", err?.message || err);
        writeConnectionStatus("error", err?.message || String(err));
      }
    });

    saveSessionString(client.session.save());
    const me = await client.getMe();
    connectedAs =
      [me.firstName, me.lastName].filter(Boolean).join(" ") ||
      me.username ||
      String(me.id);
    writeConnectionStatus("ready");
    console.log(`✅ Conectado como: ${connectedAs} (id ${me.id})`);
    console.log("🤖 Atendimento Telegram ativo (DMs).");
  } catch (error) {
    const msg = error?.message || String(error);
    console.error("❌ Falha ao iniciar Telegram:", msg);
    writeConnectionStatus("error", msg);
  }
}

app.listen(port, "127.0.0.1", () => {
  console.log(`🌐 TG API local http://127.0.0.1:${port}`);
  void startTelegram();
});
