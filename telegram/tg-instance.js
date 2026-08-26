/**
 * Motor Telegram — conta de USUÁRIO via MTProto (GramJS).
 * Não usa Bot API. Fluxo: Telegram pessoal → IA → Telegram pessoal.
 */
const fs = require("fs");
const path = require("path");
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
  let text = String(completion.choices[0]?.message?.content || "").trim();
  text = text.replace(/\[\[.*?\]\]/g, "").trim();
  if (!text) text = "oii amor, me fala melhor o que você quer? 💕";
  conv.push({ role: "assistant", content: text });
  saveConversations();
  return text;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

    await client.invoke(
      new Api.messages.SetTyping({
        peer: await event.getInputChat(),
        action: new Api.SendMessageTypingAction()
      })
    );

    const delay = Number(loadBotConfig().messageDelayMs) || 2500;
    await sleep(Math.round(delay * (0.85 + Math.random() * 0.3)));

    const reply = await generateReply(chatId, text);
    await event.respond(reply);
    void panelLog({
      type: "message",
      jid: `tg:${chatId}`,
      chatId,
      role: "assistant",
      content: reply
    });
    console.log(`✅ Resposta: ${reply}`);
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
